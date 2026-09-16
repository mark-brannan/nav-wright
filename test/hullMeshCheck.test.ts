// The acceptance gate for a candidate hull mesh (nav-wright#34).
//
// anchorLights() does not need a pretty mesh; it needs three things it can
// read back out of one. This runs the real modelTransform functions over
// every .glb in HULL_MESH_DIR and prints a table saying which meshes have
// them:
//
//   1. a pointed bow — halfBeam falls toward one end, so bowShoulder()
//      lands forward of midships and not at the extreme tip;
//   2. a real gunwale — deck[] is a rail edge distinct from top[] where
//      there is superstructure, i.e. DECK_EDGE_BAND catches the rail;
//   3. a mast band — mast.aftX..foreX is a narrow span, not the whole hull.
//
// Skipped with no HULL_MESH_DIR set, because the meshes are not in the repo:
//
//   HULL_MESH_DIR=/path/to/glbs npx vitest run test/hullMeshCheck.test.ts
//
// glTF is Y-up with no fixed heading, so the hull's own axes are recovered
// from its bounding box — longest horizontal axis is the length — and both
// headings are tried, keeping whichever reads better. A real integration
// would know its models' orientation; this only has to judge the shape.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  PROFILE_STATIONS,
  bowShoulder,
  placeHullModel,
  sampleEdges,
  stationProfile,
  type ModelBox,
} from '../src/modelTransform.js';

/** Any length works: every criterion is a ratio. */
const LENGTH = 30;

/** Bow shoulder as a fraction of the half-length forward of midships. Below
 * the floor the hull is a box; above the ceiling the taper is a single tip
 * and a sidelight seated there sits on nothing. */
const BOW_RANGE: [number, number] = [0.05, 0.92];
/** A station has a rail when its top stands this far above its deck edge,
 * as a fraction of the hull's height. */
const RAIL_GAP = 0.08;
/** Stations needing a rail before the mesh counts as having a gunwale. */
const RAIL_STATIONS = 3;
/** Widest mast band, as a fraction of hull length, that still reads as a
 * mast rather than as the whole superstructure. */
const MAST_SPAN = 0.35;

interface Points {
  xyz: number[];
  index: number[];
}

/** three's texture path reaches for browser globals under Node. The profile
 * is geometry only, so stub them rather than decode an image; GLTFLoader
 * still warns about the texture it could not fetch, which is harmless. */
const g = globalThis as Record<string, unknown>;
g.self ??= globalThis;
g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

function loadScene(file: string): Promise<THREE.Object3D> {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (g) => resolve(g.scene), reject);
  });
}

/** Every mesh's vertices in scene coordinates, with one merged triangle
 * index so sampleEdges() sees the real edges rather than the seams between
 * the parts. */
function meshPoints(scene: THREE.Object3D): Points {
  scene.updateMatrixWorld(true);
  const xyz: number[] = [];
  const index: number[] = [];
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) return;
    const base = xyz.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
      xyz.push(v.x, v.y, v.z);
    }
    const idx = mesh.geometry.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) index.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) index.push(base + i);
  });
  return { xyz, index };
}

/** Permute a Y-up glTF onto the Z-up, bow-on-local-+X convention
 * placeHullModel() expects, so the placement under test is the real one. */
function toSourceFrame(
  pts: Points,
  flip: boolean,
): { xyz: number[]; box: ModelBox; dims: [number, number, number] } {
  const n = pts.xyz.length / 3;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      const value = pts.xyz[i * 3 + a];
      if (value < lo[a]) lo[a] = value;
      if (value > hi[a]) hi[a] = value;
    }
  }
  const lenAxis = hi[0] - lo[0] >= hi[2] - lo[2] ? 0 : 2;
  const beamAxis = lenAxis === 0 ? 2 : 0;
  const s = flip ? -1 : 1;
  const xyz = new Array<number>(n * 3);
  for (let i = 0; i < n; i++) {
    xyz[i * 3] = s * pts.xyz[i * 3 + lenAxis];
    xyz[i * 3 + 1] = pts.xyz[i * 3 + beamAxis];
    xyz[i * 3 + 2] = pts.xyz[i * 3 + 1];
  }
  const box: ModelBox = {
    min: { x: s > 0 ? lo[lenAxis] : -hi[lenAxis], y: lo[beamAxis], z: lo[1] },
    max: { x: s > 0 ? hi[lenAxis] : -lo[lenAxis], y: hi[beamAxis], z: hi[1] },
  };
  return {
    xyz,
    box,
    dims: [hi[lenAxis] - lo[lenAxis], hi[beamAxis] - lo[beamAxis], hi[1] - lo[1]],
  };
}

/** placeHullModel()'s output, applied. rotationX = -pi/2 maps local
 * (x, y, z) onto world (x, z, -y). */
function toWorld(src: number[], box: ModelBox): number[] {
  const { scale, position } = placeHullModel(box, LENGTH);
  const n = src.length / 3;
  const out = new Array<number>(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = scale * src[i * 3] + position[0];
    out[i * 3 + 1] = scale * src[i * 3 + 2] + position[1];
    out[i * 3 + 2] = -scale * src[i * 3 + 1] + position[2];
  }
  return out;
}

export interface MeshVerdict {
  model: string;
  verts: number;
  /** Beam and height as fractions of length. */
  dims: [number, number, number];
  bow: number;
  railStations: number;
  railGap: number;
  mastSpan: number;
  bowOk: boolean;
  railOk: boolean;
  mastOk: boolean;
  score: number;
}

function judge(pts: Points, flip: boolean, model: string): MeshVerdict | null {
  const src = toSourceFrame(pts, flip);
  const dense = sampleEdges(toWorld(src.xyz, src.box), pts.index, LENGTH / (PROFILE_STATIONS * 2));
  const profile = stationProfile(dense);
  if (!profile) return null;

  const length = profile.maxX - profile.minX;
  const mid = (profile.maxX + profile.minX) / 2;
  const bow = (bowShoulder(profile) - mid) / (length / 2);

  const height = Math.max(...profile.top);
  const gaps = profile.top.map((t, i) => t - profile.deck[i]);
  const railStations = gaps.filter((g) => g > 0.03 * height).length;
  const railGap = Math.max(...gaps) / height;
  const railFinite = profile.deck.every((d) => Number.isFinite(d));

  const mastSpan = (profile.mast.foreX - profile.mast.aftX) / length;

  const bowOk = bow > BOW_RANGE[0] && bow < BOW_RANGE[1];
  const railOk = railFinite && railStations >= RAIL_STATIONS && railGap > RAIL_GAP;
  const mastOk = mastSpan < MAST_SPAN;
  return {
    model,
    verts: pts.xyz.length / 3,
    dims: src.dims.map((d) => +(d / src.dims[0]).toFixed(2)) as [number, number, number],
    bow: +bow.toFixed(2),
    railStations,
    railGap: +railGap.toFixed(2),
    mastSpan: +mastSpan.toFixed(2),
    bowOk,
    railOk,
    mastOk,
    score: Number(bowOk) + Number(railOk) + Number(mastOk),
  };
}

/** The better-reading of the two headings for one mesh. */
export async function checkHullMesh(file: string): Promise<MeshVerdict | null> {
  const pts = meshPoints(await loadScene(file));
  if (pts.xyz.length === 0) return null;
  let best: MeshVerdict | null = null;
  for (const flip of [false, true]) {
    const v = judge(pts, flip, basename(file, '.glb'));
    if (!v) continue;
    if (!best || v.score > best.score || (v.score === best.score && v.bow > best.bow)) best = v;
  }
  return best;
}

function table(rows: MeshVerdict[]): string {
  const pad = (s: unknown, n: number): string => String(s).padEnd(n);
  const mark = (ok: boolean, v: unknown): string => (ok ? '+' : '-') + v;
  const lines = [
    pad('model', 26) + pad('verts', 7) + pad('L:B:H', 16) + pad('bow', 7) + pad('rail', 12) + 'mast',
  ];
  for (const r of rows) {
    lines.push(
      pad(r.model, 26) +
        pad(r.verts, 7) +
        pad(r.dims.join(':'), 16) +
        pad(mark(r.bowOk, r.bow), 7) +
        pad(mark(r.railOk, `${r.railStations}/${r.railGap}`), 12) +
        mark(r.mastOk, r.mastSpan),
    );
  }
  const all = rows.filter((r) => r.score === 3).length;
  lines.push(
    `\n${all}/${rows.length} pass all three — ` +
      `bow ${rows.filter((r) => r.bowOk).length}, ` +
      `rail ${rows.filter((r) => r.railOk).length}, ` +
      `mast ${rows.filter((r) => r.mastOk).length}`,
  );
  return lines.join('\n');
}

const dir = process.env.HULL_MESH_DIR;

describe.skipIf(!dir)('candidate hull meshes', () => {
  it('reports what anchorLights can read out of each', async () => {
    const files = readdirSync(dir as string)
      .filter((f) => f.toLowerCase().endsWith('.glb'))
      .sort()
      .map((f) => join(dir as string, f));
    expect(files.length).toBeGreaterThan(0);
    const rows: MeshVerdict[] = [];
    for (const f of files) {
      const v = await checkHullMesh(f);
      if (v) rows.push(v);
    }
    console.log('\n' + table(rows));
    expect(rows.length).toBe(files.length);
  }, 120_000);
});
