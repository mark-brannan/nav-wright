// The 3D view frames the vessel, never the mesh (searoom#174, nav-wright#85):
// scaled and centred from her length and her spec's own heights, so she
// holds one on-screen size whatever her length, nothing leaves the canvas
// from any bearing or tilt, and swapping Benchy in for her own mesh changes
// the mesh and nothing else: same length on screen, same place.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VIEW_FRAME,
  anchorLights,
  frameBox,
  lightRadius,
  orbitAngles,
  orbitPosition,
  viewFrame,
} from '../src/modelTransform.js';
import type { LightSeat } from '../src/modelTransform.js';
import { allHulls, selectHull } from '../src/hulls.js';
import { meshCatalog } from '../src/meshCatalog.js';
import { framedTo, meshTopZ } from '../src/modelTransform.js';
import type { HullSpec } from '../src/hulls.js';
import { placeScene, profileHullModel } from '../src/sceneProfile.js';
import { MAX_TILT, MIN_TILT } from '../src/tilt.js';

// three's texture path reaches for browser globals under Node; the frame is
// geometry only.
const g = globalThis as Record<string, unknown>;
g.self ??= globalThis;
g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const MODELS = join(__dirname, '..', 'models');
const BENCHY = '3dbenchy-lowpoly.glb';

function load(file: string): Promise<THREE.Object3D> {
  const buf = readFileSync(join(MODELS, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (gltf) => resolve(gltf.scene), reject);
  });
}

const scenes = new Map<string, THREE.Object3D>();
beforeAll(async () => {
  for (const f of readdirSync(MODELS).filter((f) => f.endsWith('.glb')))
    scenes.set(f, await load(f));
});

const specs: HullSpec[] = Object.values(allHulls).map((h) => h.spec);
const spec = (id: string): HullSpec => specs.find((s) => s.id === id)!;

/** The lights the 2D profile hangs on a spec: masthead, aft masthead,
 * sidelights and sternlight. Enough to frame and seat; arcs don't matter. */
function lightsOf(s: HullSpec): LightSeat[] {
  const out: LightSeat[] = [
    { fx: s.mastX, py: 0, z: s.mastTopZ },
    { fx: s.sideLightX, py: s.beam, z: s.sideLightZ },
    { fx: s.sideLightX, py: -s.beam, z: s.sideLightZ },
    { fx: s.sternX, py: 0, z: s.sternZ },
  ];
  if (Number.isFinite(s.aftMastX)) out.push({ fx: s.aftMastX, py: 0, z: s.aftMastTopZ });
  return out;
}

/** Everything BenchyModel's Hull draws, in view units: the mesh's vertices
 * and each light's halo, seated on that mesh. */
function drawn(
  file: string,
  s: HullSpec,
  L: number,
  topZ?: number,
): { mesh: THREE.Vector3[]; lights: THREE.Vector3[] } {
  const scene = scenes.get(file)!;
  const placed = placeScene(scene, L, s);
  const lights = lightsOf(s);
  const { scale, position } = viewFrame(L, framedTo(s, topZ), lights);
  const view = (v: THREE.Vector3): THREE.Vector3 =>
    v.multiplyScalar(scale).add(new THREE.Vector3(...position));
  const mesh: THREE.Vector3[] = [];
  placed.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++)
      mesh.push(view(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)));
  });
  const profile = profileHullModel(scene, L, s)!;
  const halo = lightRadius(L) * 2.6;
  const seats = anchorLights(lights, L, s, profile, lightRadius(L)).flatMap(([x, y, z]) =>
    [-1, 1].flatMap((d) => [
      view(new THREE.Vector3(x + d * halo, y, z)),
      view(new THREE.Vector3(x, y + d * halo, z)),
      view(new THREE.Vector3(x, y, z + d * halo)),
    ]),
  );
  return { mesh, lights: seats };
}

function camera(theta: number, tilt: number): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(
    VIEW_FRAME.fov,
    VIEW_FRAME.aspect,
    VIEW_FRAME.near,
    VIEW_FRAME.far,
  );
  c.position.set(...orbitPosition(theta, tilt));
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld(true);
  return c;
}

/** Bow to stern on screen, as a fraction of the canvas width, seen from
 * the starboard beam at the default tilt: the length the viewer compares. */
function screenLength(points: THREE.Vector3[]): number {
  const cam = camera(90, 10);
  const xs = points.map((p) => p.clone().project(cam).x);
  return (Math.max(...xs) - Math.min(...xs)) / 2;
}

/** The furthest any point lands from the canvas centre, in NDC (1 is the edge). */
function reach(points: THREE.Vector3[], theta: number, tilt: number): number {
  const cam = camera(theta, tilt);
  let r = 0;
  for (const p of points) {
    const q = p.clone().project(cam);
    r = Math.max(r, Math.abs(q.x), Math.abs(q.y));
  }
  return r;
}

const TILTS = [MIN_TILT, -30, -5, 0, 10, 30, 60, MAX_TILT];
const BEARINGS = Array.from({ length: 24 }, (_, i) => i * 15);
const LENGTHS = [2, 5, 15, 40, 100, 400];

/** A shipped mesh, the hull spec she is drawn for, and her top from the
 * catalog (meshTopZ) where she stands taller than the spec's masts. */
type Pair = [string, HullSpec, number?];

/** The hull a shipped mesh is drawn for: a loft's own drawing; a traced
 * vessel the sailing spec of her size (as the playground's vessels page); a
 * kit mesh the hull selectHull picks for the catalog's record of her. Benchy
 * stands on every hull and is paired below. */
function own(f: string): Pair | undefined {
  const r = meshCatalog.find((m) => m.file === f);
  if (!r || r.kind === 'calibration') return undefined;
  const topZ = meshTopZ(r.proportions.lengthHeight);
  const loft = f.match(/^loft-(.*?)(-slender|-sheered|-highside)?\.glb$/);
  if (loft) return [f, spec(loft[1]!), topZ];
  if (r.kind === 'traced') return [f, spec(r.loaM! < 20 ? 'sail-small' : 'sail-large'), topZ];
  const propulsion = r.propulsion.includes('sail')
    ? 'propulsion:sail'
    : r.propulsion.includes('power')
      ? 'propulsion:power'
      : 'propulsion:oars';
  return [
    f,
    selectHull({
      'fact:position': 'position:underway',
      'fact:propulsion': propulsion,
      'fact:activity': 'activity:none',
      'fact:length_m': r.loaM ?? 12,
    }).spec,
    topZ,
  ];
}

/** Every shipped mesh with the hull it is drawn for, and Benchy on every hull. */
function pairs(): Pair[] {
  const out: Pair[] = specs.map((s) => [BENCHY, s]);
  for (const f of scenes.keys()) {
    const p = own(f);
    if (p) out.push(p);
  }
  return out;
}

describe('view frame', () => {
  it('orbits midships, above the waterline', () => {
    for (const s of specs) {
      const { position } = viewFrame(15, s, lightsOf(s));
      expect(position[0]).toBe(0);
      expect(position[2]).toBe(0);
      expect(position[1], s.id).toBeLessThan(0);
    }
  });

  it('holds her on-screen length at every length', () => {
    for (const id of ['power-small', 'power-large', 'sail-large', 'tanker']) {
      for (const file of [BENCHY, [...scenes.keys()].find((f) => own(f)?.[1].id === id)!]) {
        const ref = screenLength(drawn(file, spec(id), 15).mesh);
        for (const L of LENGTHS)
          expect(
            screenLength(drawn(file, spec(id), L).mesh),
            `${file} on ${id} at ${L} m`,
          ).toBeCloseTo(ref, 9);
      }
    }
  });

  it('draws Benchy the same length as the mesh she stands in for', () => {
    for (const [file, s] of pairs()) {
      // A traced vessel is fitted by her hull's own extent; her spars reach
      // past it, so her mesh spans more than the spec she stands on.
      if (file === BENCHY || meshCatalog.find((m) => m.file === file)?.kind === 'traced') continue;
      const mine = drawn(file, s, 40).mesh;
      const benchy = drawn(BENCHY, s, 40).mesh;
      // Bow to stern in view units: both are fitted to the spec's span.
      const span = (ps: THREE.Vector3[]): number =>
        Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
      expect(span(benchy), file).toBeCloseTo(span(mine), 9);
      // On screen, a wide mesh's near side spreads a little in perspective.
      const ratio = screenLength(benchy) / screenLength(mine);
      expect(ratio, file).toBeGreaterThan(0.92);
      expect(ratio, file).toBeLessThan(1.08);
    }
  });

  it('keeps every mesh and her lights on the canvas from every bearing and tilt', () => {
    for (const [file, s, topZ] of pairs()) {
      const d = drawn(file, s, 30, topZ);
      for (const theta of BEARINGS)
        for (const tilt of TILTS)
          expect(
            reach([...d.mesh, ...d.lights], theta, tilt),
            `${file} on ${s.id}, θ ${theta}, tilt ${tilt}`,
          ).toBeLessThan(1);
    }
  }, 30_000);

  it('keeps the frame itself inside the margin, from between the checked angles too', () => {
    // The frame is solved on a 3-degree grid; a box corner between grid
    // points must not slip past the canvas edge.
    for (const s of specs) {
      const lights = lightsOf(s);
      const { scale, position } = viewFrame(1, s, lights);
      const box = frameBox(s, lights);
      const corners: THREE.Vector3[] = [];
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z])
            corners.push(
              new THREE.Vector3(x, y, z).multiplyScalar(scale).add(new THREE.Vector3(...position)),
            );
      for (let theta = 0.5; theta < 360; theta += 7)
        for (let tilt = MIN_TILT + 0.5; tilt <= MAX_TILT; tilt += 4)
          expect(reach(corners, theta, tilt), `${s.id} θ ${theta} tilt ${tilt}`).toBeLessThan(1);
    }
  });

  it('keeps each light on the same spot of the hull at every length', () => {
    const s = spec('power-large');
    const seat = (L: number): number[][] => {
      const { scale, position } = viewFrame(L, s, lightsOf(s));
      const profile = profileHullModel(scenes.get(BENCHY)!, L, s)!;
      return anchorLights(lightsOf(s), L, s, profile, lightRadius(L)).map((p) =>
        p.map((v, k) => v * scale + position[k]),
      );
    };
    const ref = seat(12);
    for (const L of LENGTHS)
      seat(L).forEach((p, i) =>
        p.forEach((v, k) => expect(v, `light ${i} axis ${k} at ${L} m`).toBeCloseTo(ref[i][k], 6)),
      );
  });

  it('draws a nonsense length as it is rather than blowing it up', () => {
    const s = spec('tug');
    for (const L of [0, -3, NaN, Infinity])
      expect(viewFrame(L, s)).toEqual({ scale: 1, position: [0, 0, 0] });
  });

  it('frames a vessel with no spec on her full length', () => {
    const box = frameBox({ beam: 0, sternX: NaN, bowX: NaN });
    expect(box.min.x).toBeLessThan(-0.5);
    expect(box.max.x).toBeGreaterThan(0.5);
  });

  it('puts the camera ahead at theta 0 and on the starboard beam at 90', () => {
    const [ax, , az] = orbitPosition(0, 0);
    expect(ax).toBeCloseTo(VIEW_FRAME.distance, 9);
    expect(az).toBeCloseTo(0, 9);
    const [bx, , bz] = orbitPosition(90, 0);
    expect(bx).toBeCloseTo(0, 9);
    expect(bz).toBeCloseTo(VIEW_FRAME.distance, 9);
  });

  it('clamps tilt to MIN_TILT and MAX_TILT, and lets the camera go below the waterline', () => {
    expect(orbitPosition(45, -120)).toEqual(orbitPosition(45, MIN_TILT));
    expect(orbitPosition(45, 120)).toEqual(orbitPosition(45, MAX_TILT));
    expect(orbitPosition(45, -20)[1]).toBeLessThan(0);
  });

  it('reports a drag just short of dead ahead as theta 0, never 360', () => {
    const DEG = Math.PI / 180;
    // theta 359.7 is three's azimuth 90.3 degrees.
    expect(orbitAngles(90.3 * DEG, 80 * DEG)).toEqual({ theta: 0, tilt: 10 });
    expect(orbitAngles(-179.9 * DEG, 90 * DEG).theta).toBe(270);
  });

  it.each([0, 1, 45, 90, 179, 180, 270, 359])(
    'reads back theta %i from where orbitPosition puts the camera',
    (theta) => {
      const [x, y, z] = orbitPosition(theta, 30);
      const s = new THREE.Spherical().setFromCartesianCoords(x, y, z);
      expect(orbitAngles(s.theta, s.phi)).toEqual({ theta, tilt: 30 });
    },
  );
});
