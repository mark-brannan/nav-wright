// How bright a light reads from a bearing and a range, 0..1, for the 3D
// bearing view's prototype tuning surface (#118). Leaving it off keeps the
// exam's hard cut: in arc or not (bearingInArc).
//
// Horizontal: Annex I §9(a). An arc edge on the bow (a sidelight's forward
// limit) holds full intensity to the limit and cuts off 1 to 3 degrees
// outside it (§9(a)(i)). Every other edge (masthead, sternlight, towing, a
// sidelight's aft limit) holds full to 5 degrees inside, may fall by half at
// the limit, and cuts off at most 5 degrees outside (§9(a)(ii)). The fall is
// linear: "shall decrease steadily".
//
// Range: Annex I §8. A light of luminous range D sits exactly at the eye's
// threshold at D. At d its illuminance over the threshold is
// (D/d)^2 * K^(d - D), so it fades out past its reach instead of holding a
// floor.

import type { Arc } from 'colregs-engine/schema';
import type { PlacedLight } from './placement.js';

/** How bright a light reads, 0..1, from relative bearing `theta`. */
export type LightIntensity = (light: PlacedLight, theta: number) => number;

/** One arc edge, in degrees of bearing from the limit. */
export interface EdgeProfile {
  /** Degrees inside the limit where the fall towards the limit begins. */
  inside: number;
  /** Intensity at the limit itself, 0..1. */
  atLimit: number;
  /** Degrees outside the limit where the light is gone. */
  outside: number;
}

export interface SectorProfile {
  /** An edge on the bow: the sidelights' forward limit, §9(a)(i). */
  forward: EdgeProfile;
  /** Every other edge, §9(a)(ii). */
  aft: EdgeProfile;
}

/** Annex I's envelope, with the open choices set mid-way: a 2 degree cut-off
 *  forward (1 to 3 allowed); the full 50% fall and a 5 degree tail aft. */
export const ANNEX_I_PROFILE: SectorProfile = {
  forward: { inside: 0, atLimit: 1, outside: 2 },
  aft: { inside: 5, atLimit: 0.5, outside: 5 },
};

/** Annex I §8 atmospheric transmissivity for prescribed lights. */
export const K_PRESCRIBED = 0.8;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const onBow = (deg: number) => norm(deg) === 0;

function insideEdge(d: number, p: EdgeProfile): number {
  if (d >= p.inside) return 1;
  return p.atLimit + ((1 - p.atLimit) * d) / p.inside;
}

function outsideEdge(d: number, p: EdgeProfile): number {
  if (!(p.outside > 0) || d >= p.outside) return 0;
  return p.atLimit * (1 - d / p.outside);
}

/** Intensity 0..1 of a light with `arc` seen from relative `bearing`. A null
 *  arc (torch, deck lights) and a full circle are 1 everywhere. */
export function sectorIntensity(
  bearing: number,
  arc: Arc | null | undefined,
  profile: SectorProfile = ANNEX_I_PROFILE,
): number {
  if (arc == null) return 1;
  const { from_deg: f, to_deg: t } = arc;
  let extent = t - f;
  if (extent <= 0) extent += 360;
  if (extent >= 360) return 1;
  const fromEdge = onBow(f) ? profile.forward : profile.aft;
  const toEdge = onBow(t) ? profile.forward : profile.aft;
  const rel = norm(bearing - f);
  if (rel <= extent) return Math.min(insideEdge(rel, fromEdge), insideEdge(extent - rel, toEdge));
  return Math.max(outsideEdge(rel - extent, toEdge), outsideEdge(360 - rel, fromEdge));
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Opacity 0..1 of a light of luminous range `reachNm` seen at `viewingNm`.
 *  Full well inside the reach, faint at it (the eye's threshold), gone a
 *  little beyond. Unknown reach or range: 1. */
export function rangeVisibility(
  reachNm: number | undefined,
  viewingNm: number | undefined,
  k: number = K_PRESCRIBED,
): number {
  if (reachNm === undefined || !(reachNm > 0)) return 1;
  if (viewingNm === undefined || !Number.isFinite(viewingNm)) return 1;
  if (viewingNm <= 0) return 1;
  const overThreshold = (reachNm / viewingNm) ** 2 * k ** (viewingNm - reachNm);
  // log2: 8x the threshold is full, the threshold itself about 0.16, half of it nothing
  return smoothstep(-1, 3, Math.log2(overThreshold));
}
