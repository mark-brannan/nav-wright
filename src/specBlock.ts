// The spec block: a rough, blocky hull built from the hull spec and the
// lights placed on it, not from a mesh. A mesh is someone's drawing of a
// vessel and misses the spec's stations in places; the block is built
// around them, so every light sits on it. It is what the silhouette view
// draws when the hull's shape matters less than where the lights are.
//
// Pure: no three.js, no React. Positions are in the 3D view's world, in
// metres (lightPosition's frame): x fore-aft (bow +), y up from the
// waterline, z athwartships (starboard +).

import type { HullSpec } from './hulls.js';
import { LIGHT_Z_TO_X, SIDE_LIGHT_BAND, lightPosition, lightRadius } from './modelTransform.js';

/** The parts of a HullSpec the block is built from. A HullSpec fits. */
export type BlockSpec = Pick<
  HullSpec,
  'beam' | 'mastX' | 'mastTopZ' | 'sideLightX' | 'sideLightZ' | 'bowX' | 'sternX' | 'sternZ'
>;

/** A light as the block reads it: placeLights' fx/py/z. */
export interface BlockLight {
  fx: number;
  py: number;
  z: number;
}

/** A vertical prism: a convex outline in plan, as [x, z] pairs, extruded
 * from `bottom` to `top` (y). The block is a union of these. */
export interface BlockPrism {
  outline: [number, number][];
  bottom: number;
  top: number;
}

/** How thick a mast is, as a fraction of the half-length. */
export const BLOCK_MAST = 0.03;

/** The narrowest the bow taper may be, as a fraction of the half-length. */
const MIN_TAPER = 0.15;

/**
 * The block for a vessel of `lengthMeters`: a hull body extruded from the
 * spec's plan (transom, parallel sides to the bow shoulder, a taper to the
 * bow), a deck at the sidelights' and stern light's height, and a mast at
 * every station a light stands above the deck, with a yard out to any light
 * outboard of its mast. Every light in `lights` lies inside it, by at least
 * a light's bead radius where the shape allows: the guarantee a mesh cannot
 * give.
 */
export function specBlock(
  spec: BlockSpec,
  lights: readonly BlockLight[],
  lengthMeters: number,
): BlockPrism[] {
  const L = Number.isFinite(lengthMeters) && lengthMeters > 0 ? lengthMeters : 12;
  const h = L / 2;
  const pad = lightRadius(L);
  const at = lights.map((l) => lightPosition(l, L));
  const yOf = (z: number) => z * h * LIGHT_Z_TO_X;

  // Sidelights: on the hull's side, so they set the deck and the beam.
  const isSide = (l: BlockLight) => {
    const r = spec.beam > 0 ? Math.abs(l.py) / spec.beam : 0;
    return r >= SIDE_LIGHT_BAND[0] && r <= SIDE_LIGHT_BAND[1];
  };
  const side = at.filter((_, i) => isSide(lights[i]));

  const deck = Math.max(yOf(spec.sideLightZ), yOf(spec.sternZ), ...side.map((p) => p[1])) + pad;
  const halfBeam = Math.max(spec.beam * h, ...side.map((p) => Math.abs(p[2]))) + pad;
  const stern = Math.min(spec.sternX * h, ...at.map((p) => p[0])) - pad;
  const bow = Math.max(spec.bowX * h, ...at.map((p) => p[0])) + pad;

  // The bow shoulder: forward of every sidelight, but leaving a taper.
  const sideFore = Math.max(spec.sideLightX * h, ...side.map((p) => p[0])) + pad;
  const shoulder = Math.max(stern + pad, Math.min(sideFore, bow - MIN_TAPER * h));
  // Half-width the bow end keeps, so a sidelight in the taper is still inside.
  let bowHalf = 0;
  for (const [x, , z] of side) {
    if (x <= shoulder) continue;
    const t = (x - shoulder) / (bow - shoulder);
    if (t >= 1) {
      bowHalf = Math.max(bowHalf, Math.abs(z) + pad);
      continue;
    }
    // halfBeam + t * (bowHalf - halfBeam) >= |z| + pad
    bowHalf = Math.max(bowHalf, (Math.abs(z) + pad - halfBeam * (1 - t)) / t);
  }
  bowHalf = Math.min(halfBeam, Math.max(0, bowHalf));

  const outline: [number, number][] = [
    [stern, -halfBeam],
    [shoulder, -halfBeam],
    [bow, -bowHalf],
    ...(bowHalf > 0 ? [[bow, bowHalf] as [number, number]] : []),
    [shoulder, halfBeam],
    [stern, halfBeam],
  ];
  const body: BlockPrism = { outline, bottom: 0, top: deck };
  const prisms: BlockPrism[] = [body];

  // Masts: one per station with a light the body does not hold, and the
  // spec's own mast, which every hull has.
  const w = Math.max(BLOCK_MAST * h, pad * 1.5);
  const stations = new Map<
    number,
    { x: number; top: number; lights: [number, number, number][] }
  >();
  const station = (x: number) => {
    const key = Math.round(x * 1000);
    let s = stations.get(key);
    if (!s) stations.set(key, (s = { x, top: deck, lights: [] }));
    return s;
  };
  const mast = station(spec.mastX * h);
  mast.top = Math.max(mast.top, yOf(spec.mastTopZ));
  at.forEach((p) => {
    if (insidePrism(body, p)) return;
    const s = station(p[0]);
    s.top = Math.max(s.top, p[1] + pad);
    s.lights.push(p);
  });

  for (const s of stations.values()) {
    const onBody = s.x >= stern && s.x <= bow;
    const bottom = onBody ? deck : 0;
    if (s.top > bottom) prisms.push(box(s.x - w, s.x + w, -w, w, bottom, s.top));
    // Yards: one per side and height, out to the farthest light there.
    const yards = new Map<string, { y: number; reach: number; sign: number }>();
    for (const [, y, z] of s.lights) {
      if (Math.abs(z) <= w - pad) continue;
      const sign = Math.sign(z);
      const key = `${sign}:${Math.round(y * 1000)}`;
      const yard = yards.get(key);
      const reach = Math.abs(z) + pad;
      if (!yard || reach > yard.reach) yards.set(key, { y, reach, sign });
    }
    for (const { y, reach, sign } of yards.values()) {
      const [z0, z1] = sign > 0 ? [w, reach] : [-reach, -w];
      prisms.push(box(s.x - w, s.x + w, z0, z1, y - w, y + w));
    }
  }
  return prisms;
}

function box(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  bottom: number,
  top: number,
): BlockPrism {
  return {
    outline: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    bottom,
    top,
  };
}

/** Is world point `p` inside (or on) the prism? */
export function insidePrism(prism: BlockPrism, p: readonly [number, number, number]): boolean {
  const [x, y, z] = p;
  if (y < prism.bottom - 1e-9 || y > prism.top + 1e-9) return false;
  return insideConvex(prism.outline, x, z);
}

/** Point in a convex polygon of either winding, edges inclusive. */
function insideConvex(poly: readonly [number, number][], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** The prism grown by `d` on every side, for a feathered edge; the hull
 * body keeps its bottom on the waterline. The outline is offset along each
 * corner's mitre, capped at twice `d` so a sharp bow does not spike. */
export function growPrism(prism: BlockPrism, d: number): BlockPrism {
  const poly = prism.outline;
  const n = poly.length;
  const area = poly.reduce((a, [x, z], i) => {
    const [x2, z2] = poly[(i + 1) % n];
    return a + x * z2 - x2 * z;
  }, 0);
  const ccw = area > 0 ? 1 : -1;
  const normal = (a: [number, number], b: [number, number]): [number, number] => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    // Outward is to the right of the edge for a CCW outline.
    return [(ccw * dz) / len, (-ccw * dx) / len];
  };
  const outline = poly.map((p, i): [number, number] => {
    const n1 = normal(poly[(i - 1 + n) % n], p);
    const n2 = normal(p, poly[(i + 1) % n]);
    const mx = n1[0] + n2[0];
    const mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz) || 1;
    const cos = (mx * n1[0] + mz * n1[1]) / ml;
    const reach = Math.min(2 * d, d / Math.max(cos, 1e-6));
    return [p[0] + (mx / ml) * reach, p[1] + (mz / ml) * reach];
  });
  return {
    outline,
    bottom: prism.bottom <= 0 ? prism.bottom : prism.bottom - d,
    top: prism.top + d,
  };
}

/**
 * The block's triangles, flat [x, y, z, ...] for a non-indexed
 * BufferGeometry, every face wound outward (counter-clockwise seen from
 * outside), so front-face culling leaves each pixel of a convex prism drawn
 * once.
 */
export function blockTriangles(prisms: readonly BlockPrism[]): number[] {
  const out: number[] = [];
  for (const { outline, bottom, top } of prisms) {
    const n = outline.length;
    const cx = outline.reduce((a, p) => a + p[0], 0) / n;
    const cz = outline.reduce((a, p) => a + p[1], 0) / n;
    const cy = (bottom + top) / 2;
    const tri = (a: number[], b: number[], c: number[]) => {
      // Outward test: the face normal against centre-to-face.
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2];
      const vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      const mx = (a[0] + b[0] + c[0]) / 3 - cx;
      const my = (a[1] + b[1] + c[1]) / 3 - cy;
      const mz = (a[2] + b[2] + c[2]) / 3 - cz;
      if (nx * mx + ny * my + nz * mz >= 0) out.push(...a, ...b, ...c);
      else out.push(...a, ...c, ...b);
    };
    for (let i = 0; i < n; i++) {
      const [ax, az] = outline[i];
      const [bx, bz] = outline[(i + 1) % n];
      tri([ax, bottom, az], [bx, bottom, bz], [bx, top, bz]);
      tri([ax, bottom, az], [bx, top, bz], [ax, top, az]);
    }
    for (let i = 1; i < n - 1; i++) {
      const [ax, az] = outline[0];
      const [bx, bz] = outline[i];
      const [qx, qz] = outline[i + 1];
      tri([ax, top, az], [bx, top, bz], [qx, top, qz]);
      tri([ax, bottom, az], [bx, bottom, bz], [qx, bottom, qz]);
    }
  }
  return out;
}
