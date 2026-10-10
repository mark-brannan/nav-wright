// Where ship-ocean-liner's navigation lights land, drawn (nav-wright#36).
//
// Runs the real modelTransform / placement functions over the Kenney
// Watercraft Kit's ship-ocean-liner.glb and writes two side views into
// docs/research/: the lights as anchorLights() seats them today, and as
// the default logged on #36 part 2 would seat them. The numbers and the
// argument are in docs/research/ship-ocean-liner-masthead.md.
//
// Skipped unless HULL_MESH_DIR holds the kit's .glb files (they are not in
// the repo; the kit is CC0, kenney.nl/assets/watercraft-kit):
//
//   HULL_MESH_DIR=/path/to/glbs npx vitest run test/oceanLinerRender.test.ts
//
// The load and frame code below is hullMeshCheck.test.ts's, narrowed to
// the one mesh; a test file cannot be imported without running its suite.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { allHulls } from '../src/hulls.js';
import {
  MAST_BAND,
  PROFILE_STATIONS,
  anchorLights,
  bowShoulder,
  placeHullModel,
  sampleEdges,
  stationProfile,
  type StationProfile,
} from '../src/modelTransform.js';
import { placeLights } from '../src/placement.js';

/** Any length works for the shape; this is the one hullMeshCheck uses. */
const LENGTH = 30;

/** Which end of the mesh's length axis is the bow. The shape alone cannot
 * say: both ends of this hull score alike on the hullMeshCheck bow test (bow
 * 0.75 either way), so that harness takes whichever it tries first. Two
 * things do: every other ship in the kit tapers toward +Z (measured over the
 * kit's boats and ships), and this hull's keel rises 3.2 m (at LENGTH 30) to
 * the +Z end, a cut-away forefoot, where the -Z end's runs out square. */
const BOW_AT_HIGH_Z = true;

const g = globalThis as Record<string, unknown>;
g.self ??= globalThis;
g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const dir = process.env.HULL_MESH_DIR;
const file = dir ? join(dir, 'ship-ocean-liner.glb') : '';
const OUT = fileURLToPath(new URL('../docs/research/', import.meta.url));

/** The lights a power-driven vessel of 50 m or more shows underway, as
 * colregs' data/applicability.json gives them: rule:23a_i (masthead
 * forward), rule:23a_ii (a second, abaft and higher), rule:23a_iii_iv
 * (sidelights and a sternlight). placeLights() reads only these fields. */
const DISPLAY = [
  ['rule:23a_i', { light: 'light:masthead', position: 'forward', count: 1 }],
  ['rule:23a_ii', { light: 'light:masthead', position: 'abaft and higher than the forward one', count: 1 }],
  ['rule:23a_iii_iv', { light: 'light:sidelights' }],
  ['rule:23a_iii_iv', { light: 'light:sternlight' }],
].map(([entry, spec]) => ({
  spec,
  source_entry: entry,
  sourceEntry: entry,
  modality: 'modality:shall',
}));

describe.skipIf(!dir || !existsSync(file))('ship-ocean-liner lights', () => {
  it('draws where the lights sit now and under the #36 part 2 default', async () => {
    const pts = await loadPoints(file);
    // The length runs along glTF Z; worldPoints() assumes it.
    expect(pts.hi[2] - pts.lo[2]).toBeGreaterThan(pts.hi[0] - pts.lo[0]);

    const profileOf = (bowAtHighZ: boolean) => {
      const xyz = worldPoints(pts, bowAtHighZ);
      const spacing = LENGTH / (PROFILE_STATIONS * 2);
      return { xyz, profile: stationProfile(sampleEdges(xyz, pts.index, spacing))! };
    };
    const { xyz, profile } = profileOf(BOW_AT_HIGH_Z);
    const other = profileOf(!BOW_AT_HIGH_Z).profile;

    // The heading is a tie on the bow-shoulder test, and a real difference
    // on the hull's underwater shape.
    expect(bowShoulder(profile)).toBeCloseTo(bowShoulder(other), 6);
    const rake = keelRise(xyz);
    expect(rake.bow).toBeGreaterThan(rake.stern + 1);

    // The band is two masts at opposite ends, not one long deck.
    const masts = bandClusters(xyz, profile);
    expect(masts).toHaveLength(2);
    const gap = masts[1].aftX - masts[0].foreX;
    expect(gap).toBeGreaterThan(0.5 * LENGTH);
    expect(profile.mast.aftX).toBe(masts[0].aftX);
    expect(profile.mast.foreX).toBe(masts[1].foreX);
    for (const m of masts) expect(m.tipY).toBe(profile.mast.top);

    // Today: both lights at the band's outer edges, lifted to the mesh's top.
    const now = seat(profile);
    // The #36 part 2 default: same edges, height taken from the middle of the
    // band's height range instead of its highest point.
    const mid = ((1 + MAST_BAND) / 2) * profile.mast.top;
    const dflt = seat({ ...profile, mast: { ...profile.mast, top: mid } });

    const fore = (all: Seat[]) => all[0].at;
    const aft = (all: Seat[]) => all[1].at;
    expect(fore(now)[0]).toBe(masts[1].foreX);
    expect(aft(now)[0]).toBe(masts[0].aftX);
    expect(fore(dflt)[0]).toBe(fore(now)[0]);
    expect(aft(dflt)[0]).toBe(aft(now)[0]);
    const shift = fore(now)[1] - fore(dflt)[1];
    expect(shift).toBeCloseTo(((1 - MAST_BAND) / 2) * profile.mast.top, 6);
    expect(aft(now)[1] - aft(dflt)[1]).toBeCloseTo(shift, 6);

    const readings = {
      'highest point (today)': profile.mast.top,
      'middle of band (default)': mid,
      'floor of band': MAST_BAND * profile.mast.top,
    };
    console.log(
      Object.entries(readings)
        .map(([k, y]) => `${k.padEnd(26)} y=${y.toFixed(2)} m  forward light ${seat({ ...profile, mast: { ...profile.mast, top: y } })[0].at[1].toFixed(2)} m`)
        .join('\n'),
    );
    console.log(now.map((l, i) => `${l.id} ${l.color}: now ${l.at.map((n) => n.toFixed(2))}  default ${dflt[i].at.map((n) => n.toFixed(2))}`).join('\n'));
    console.log(JSON.stringify({ masts, mast: profile.mast, rake }));

    const scene = { pts, xyz, profile, masts };
    writeFileSync(join(OUT, 'ship-ocean-liner-masthead-now.svg'), svg(scene, 'now', now));
    writeFileSync(join(OUT, 'ship-ocean-liner-masthead-default.svg'), svg(scene, 'default', dflt, now));
  });
});

interface Points {
  xyz: number[];
  index: number[];
  lo: number[];
  hi: number[];
}

async function loadPoints(path: string): Promise<Points> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const scene: THREE.Object3D = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (gltf) => resolve(gltf.scene), reject);
  });
  scene.updateMatrixWorld(true);
  const xyz: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    const base = xyz.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
      xyz.push(v.x, v.y, v.z);
    }
    const idx = mesh.geometry.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) index.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) index.push(base + i);
  });
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < xyz.length / 3; i++) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], xyz[i * 3 + a]);
      hi[a] = Math.max(hi[a], xyz[i * 3 + a]);
    }
  }
  return { xyz, index, lo, hi };
}

/** The mesh in the scene frame placeHullModel() defines (bow +X, up +Y,
 * starboard +Z), LENGTH long, keel on the waterline. glTF is Y-up; this mesh's
 * length runs along Z, and `bowAtHighZ` says which end is the bow. */
function worldPoints(pts: Points, bowAtHighZ: boolean): number[] {
  const { xyz, lo, hi } = pts;
  const s = bowAtHighZ ? 1 : -1;
  const box = {
    min: { x: s > 0 ? lo[2] : -hi[2], y: lo[0], z: lo[1] },
    max: { x: s > 0 ? hi[2] : -lo[2], y: hi[0], z: hi[1] },
  };
  const { scale, position } = placeHullModel(box, LENGTH);
  const n = xyz.length / 3;
  const out = new Array<number>(n * 3);
  for (let i = 0; i < n; i++) {
    // rotationX = -pi/2 maps source (x, y, z) onto world (x, z, -y), and the
    // source frame here is (s * glTF z, glTF x, glTF y).
    out[i * 3] = scale * s * xyz[i * 3 + 2] + position[0];
    out[i * 3 + 1] = scale * xyz[i * 3 + 1] + position[1];
    out[i * 3 + 2] = -scale * xyz[i * 3] + position[2];
  }
  return out;
}

/** The mast band's points split into separate clusters wherever they are
 * more than a tenth of the length apart. */
function bandClusters(xyz: number[], profile: StationProfile) {
  const floor = MAST_BAND * profile.mast.top;
  const hits: { x: number; y: number }[] = [];
  for (let i = 0; i < xyz.length / 3; i++) {
    if (xyz[i * 3 + 1] >= floor) hits.push({ x: xyz[i * 3], y: xyz[i * 3 + 1] });
  }
  hits.sort((a, b) => a.x - b.x);
  const out: { aftX: number; foreX: number; tipY: number; points: number }[] = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && h.x - last.foreX <= LENGTH / 10) {
      last.foreX = h.x;
      last.tipY = Math.max(last.tipY, h.y);
      last.points++;
    } else out.push({ aftX: h.x, foreX: h.x, tipY: h.y, points: 1 });
  }
  return out;
}

/** How far each end of the hull stands beyond the end of its keel, in
 * metres. A cut-away forefoot stands well beyond; a square end does not.
 * Keel = the lowest tenth of the height. */
function keelRise(xyz: number[]): { bow: number; stern: number } {
  let height = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < xyz.length / 3; i++) {
    height = Math.max(height, xyz[i * 3 + 1]);
    minX = Math.min(minX, xyz[i * 3]);
    maxX = Math.max(maxX, xyz[i * 3]);
  }
  let keelMin = Infinity;
  let keelMax = -Infinity;
  for (let i = 0; i < xyz.length / 3; i++) {
    if (xyz[i * 3 + 1] > 0.1 * height) continue;
    keelMin = Math.min(keelMin, xyz[i * 3]);
    keelMax = Math.max(keelMax, xyz[i * 3]);
  }
  return { bow: maxX - keelMax, stern: keelMin - minX };
}

interface Seat {
  id: string;
  color: string;
  /** World [x, y, z]: bow +X, up +Y, starboard +Z. */
  at: [number, number, number];
}

/** Every light of DISPLAY, placed on cruiseShip's drawing and seated on the
 * mesh by anchorLights(): the pipeline BenchyModel runs, with the profile
 * swapped for whichever one is under test. */
function seat(profile: StationProfile): Seat[] {
  const hull = allHulls.cruiseShip.spec;
  const placed = placeLights(
    DISPLAY as unknown as Parameters<typeof placeLights>[0],
    hull,
    {},
    { lights: {} } as unknown as Parameters<typeof placeLights>[3],
  );
  const stations = { beam: hull.beam, mastX: hull.mastX, aftMastX: hull.aftMastX, bowX: hull.bowX, sternX: hull.sternX };
  // BenchyModel's lightRadius(): how far off the surface a light is seated.
  const clearance = Math.max(LENGTH * 0.012, 0.12);
  const at = anchorLights(placed, LENGTH, stations, profile, clearance);
  return placed.map((l, i) => ({ id: l.lightId, color: l.color, at: at[i] }));
}

// --- The drawing ------------------------------------------------------------

const S = 34; // px per metre
const ML = 70; // left margin
const MT = 130; // top margin
const TOP = 15; // metres of height drawn
const WIDTH = LENGTH * S + 2 * ML;
const HEIGHT = MT + TOP * S + 110;
const X = (x: number): number => ML + (x + LENGTH / 2) * S;
const Y = (y: number): number => MT + (TOP - y) * S;
const f1 = (n: number): string => n.toFixed(1);
const f2 = (n: number): string => n.toFixed(2);

interface Scene {
  xyz: number[];
  pts: Points;
  profile: StationProfile;
  masts: ReturnType<typeof bandClusters>;
}

/** Every triangle of the mesh, side-on, as one path. All wound the same way
 * so overlaps add up under the nonzero rule instead of cancelling. */
function meshPath(xyz: number[], index: number[]): string {
  const out: string[] = [];
  for (let t = 0; t < index.length; t += 3) {
    const p = [0, 1, 2].map((k) => [X(xyz[index[t + k] * 3]), Y(xyz[index[t + k] * 3 + 1])]);
    const area =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1]);
    if (Math.abs(area) < 0.2) continue; // edge-on: a deck seen from the side
    if (area < 0) p.reverse();
    out.push(`M${p.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}Z`);
  }
  return out.join('');
}

function svg(scene: Scene, which: 'now' | 'default', seats: Seat[], was?: Seat[]): string {
  const { profile, masts } = scene;
  const top = profile.mast.top;
  const floor = MAST_BAND * top;
  const dflt = which === 'default';
  const [fore, aft, stbd, , stern] = seats;
  const dot = (s: Seat, cls: string): string => {
    const [x, y] = s.at;
    return `<circle class="${cls}" cx="${f1(X(x))}" cy="${f1(Y(y))}" r="7"/>`;
  };
  const label = (x: number, y: number, text: string, anchor = 'start', cls = ''): string =>
    `<text class="${cls}" x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}">${text}</text>`;
  const m = (n: number): string => `${f2(n)} m`;
  const pct = (y: number): string => `${Math.round((y / top) * 100)}%`;

  const lines: string[] = [];
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="t d">`,
    `<title id="t">ship-ocean-liner: navigation lights ${dflt ? 'under the nav-wright#36 part 2 default' : 'as anchorLights seats them today'}</title>`,
    `<desc id="d">Side view of the Kenney liner mesh at a length of ${LENGTH} m, bow to the right. Two masts, one at each end of the superstructure, stand highest; the mast band (the top 5% of the hull's height) covers only their tops. The forward masthead light sits at the forward mast's outer edge at ${m(fore.at[1])} and the after masthead light at the after mast's outer edge at ${m(aft.at[1])}.</desc>`,
    `<style>text{font:13px system-ui,-apple-system,"Segoe UI",sans-serif;fill:#1f2933}.h{font-size:18px;font-weight:600}.s{font-size:13px;fill:#52606d}.k{font-size:12px;fill:#52606d}.o{fill:#c2410c;font-weight:600}.b{font-weight:600;paint-order:stroke;stroke:#f8fafc;stroke-width:3px}.k{paint-order:stroke;stroke:#f8fafc;stroke-width:3px}.mesh{fill:#9fb3c8;stroke:#9fb3c8;stroke-width:.4}.wl{stroke:#3e7cb1;stroke-width:1.5}.band{fill:#f97316;fill-opacity:.16}.edge{stroke:#c2410c;stroke-width:1.2;stroke-dasharray:4 3}.cl{fill:#f97316;fill-opacity:.35;stroke:#c2410c;stroke-width:1.5}.w{fill:#fff;stroke:#111827;stroke-width:2}.g{fill:#16a34a;stroke:#111827;stroke-width:2}.r{fill:#dc2626;stroke:#111827;stroke-width:2}.ghost{fill:none;stroke:#111827;stroke-width:1.5;stroke-dasharray:3 3}.lead{stroke:#52606d;stroke-width:1}</style>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc"/>`,
    label(ML, 34, dflt ? 'ship-ocean-liner: the lights under the #36 part 2 default' : 'ship-ocean-liner: the lights as anchorLights seats them today', 'start', 'h'),
    label(ML, 56, dflt
      ? `Same two edges, but the masthead height comes from the middle of the band (${pct(top * (1 + MAST_BAND) / 2)} of the hull's height) rather than its highest point.`
      : `Both masthead lights sit at the outer edges of the mast band, lifted to the mesh's highest point (${m(top)} at a length of ${LENGTH} m).`, 'start', 's'),
    label(ML, 76, `Kenney Watercraft Kit (CC0), ship-ocean-liner.glb, side view, bow to the right. Orange: the mast band, the top 5% of the hull's height (MAST_BAND ${MAST_BAND}).`, 'start', 's'),
  );

  // water, hull, band
  lines.push(
    `<rect x="${ML}" y="${f1(Y(0))}" width="${LENGTH * S}" height="40" fill="#dbeafe" fill-opacity=".6"/>`,
    `<path class="mesh" fill-rule="nonzero" d="${meshPath(scene.xyz, scene.pts.index)}"/>`,
    `<line class="wl" x1="${ML - 20}" x2="${WIDTH - ML + 20}" y1="${f1(Y(0))}" y2="${f1(Y(0))}"/>`,
    `<rect class="band" x="${ML - 20}" y="${f1(Y(top))}" width="${LENGTH * S + 40}" height="${f1(Y(floor) - Y(top))}"/>`,
  );
  masts.forEach((c, i) => {
    lines.push(`<rect class="cl" x="${f1(X(c.aftX))}" y="${f1(Y(top))}" width="${f1(X(c.foreX) - X(c.aftX))}" height="${f1(Y(floor) - Y(top))}"/>`);
    lines.push(label((X(c.aftX) + X(c.foreX)) / 2, Y(floor) + 20, i === 0 ? 'after mast' : 'forward mast', 'middle', 'o'));
  });

  // the two edges the code reads, and the span between them
  const yDim = Y(0) + 40;
  const aftEdge = X(profile.mast.aftX);
  const foreEdge = X(profile.mast.foreX);
  lines.push(
    `<line class="edge" x1="${f1(aftEdge)}" x2="${f1(aftEdge)}" y1="${f1(Y(top))}" y2="${f1(yDim)}"/>`,
    `<line class="edge" x1="${f1(foreEdge)}" x2="${f1(foreEdge)}" y1="${f1(Y(top))}" y2="${f1(yDim)}"/>`,
    `<line class="lead" x1="${f1(aftEdge)}" x2="${f1(foreEdge)}" y1="${f1(yDim)}" y2="${f1(yDim)}" marker-start="url(#a)" marker-end="url(#a)"/>`,
    `<defs><marker id="a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L7 4L1 7" fill="none" stroke="#52606d"/></marker></defs>`,
    label(X(0), yDim - 6, `mast.aftX to mast.foreX: ${f2((profile.mast.foreX - profile.mast.aftX) / LENGTH)} of the length (hullMeshCheck wants under 0.35)`, 'middle', 'k'),
    label(aftEdge, yDim + 16, `mast.aftX ${m(profile.mast.aftX)}`, 'middle', 'k'),
    label(foreEdge, yDim + 16, `mast.foreX ${m(profile.mast.foreX)}`, 'middle', 'k'),
  );

  // today's seats as ghosts on the default drawing
  if (was) {
    for (const k of [0, 1]) {
      const [x, y] = was[k].at;
      lines.push(`<circle class="ghost" cx="${f1(X(x))}" cy="${f1(Y(y))}" r="7"/>`);
    }
  }

  // lights
  const [sx, sy] = [X(stbd.at[0]), Y(stbd.at[1])];
  lines.push(
    dot(fore, 'w'),
    dot(aft, 'w'),
    dot(stern, 'w'),
    `<path class="r" d="M${f1(sx)} ${f1(sy - 7)}A7 7 0 0 0 ${f1(sx)} ${f1(sy + 7)}Z"/>`,
    `<path class="g" d="M${f1(sx)} ${f1(sy - 7)}A7 7 0 0 1 ${f1(sx)} ${f1(sy + 7)}Z"/>`,
  );
  const two = (x: number, y: number, a: string, b: string, anchor: string): string =>
    label(x, y - 14, a, anchor, 'b') + label(x, y, b, anchor, 'k');
  const height = (k: number): string =>
    was ? `${m(seats[k].at[1])} up (today ${f2(was[k].at[1])})` : `${m(seats[k].at[1])} up`;
  lines.push(
    two(X(fore.at[0]), Y(fore.at[1]) - 22, 'forward masthead light', `Rule 23(a)(i), ${height(0)}`, 'middle'),
    two(X(aft.at[0]), Y(aft.at[1]) - 22, 'after masthead light', `Rule 23(a)(ii), ${height(1)}`, 'middle'),
    two(X(stbd.at[0]) + 14, Y(stbd.at[1]) + 4, 'sidelights', 'red and green', 'start'),
    two(X(stern.at[0]) + 14, Y(stern.at[1]) + 4, 'sternlight', 'Rule 23(a)(iv)', 'start'),
  );

  // scale and heading
  const bx = WIDTH - ML;
  lines.push(
    `<line class="lead" x1="${ML}" x2="${ML + 5 * S}" y1="${HEIGHT - 28}" y2="${HEIGHT - 28}"/>`,
    label(ML + 5 * S + 8, HEIGHT - 24, `5 m, at a length of ${LENGTH} m; the mesh is ${f2((scene.pts.hi[1] - scene.pts.lo[1]) / (scene.pts.hi[2] - scene.pts.lo[2]))} as tall as it is long`, 'start', 'k'),
    label(bx, HEIGHT - 24, 'bow →', 'end', 'b'),
    '</svg>',
  );
  return lines.join('\n') + '\n';
}
