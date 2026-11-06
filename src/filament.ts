// Annex I §5: a combined lantern (a tricolour, Rule 25(b)) has "a single
// vertical filament and a very narrow division" between its colours, not
// screens. The filament has width, so near a division a viewer sees part of
// it through one filter and part through the other: the two colours bleed
// into each other over a few degrees instead of cutting at the limit. Dead
// ahead a tricolour reads red and green at once; at 112.5 and 247.5 a
// sidelight's colour and white.
//
// The model: across a band `bleedDeg` wide centred on a division, the share
// of the filament seen through each side's filter runs linearly from one to
// none. The two shares sum to 1, so the lantern is no brighter at the
// division than either side of it. Outside the band a division is a hard
// cut: the bleed stands in for Annex I §9(a)'s edge profile there, whose
// tails are a screen's, not a filament's. An edge no other member shares
// keeps whatever the view draws today. Pure; placement is untouched.

import type { Arc } from 'colregs-engine/schema';
import type { PlacedLight } from './placement.js';

/** The playground slider's top, degrees of bearing across a division. */
export const MAX_FILAMENT_BLEED = 10;

/** One edge of a combined light's arc that abuts another member of the
 *  same fixture. `inward` is +1 when bearing increases into the arc (its
 *  from edge), -1 when it decreases into it (its to edge). */
export interface Division {
  at: number;
  inward: 1 | -1;
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** Signed a - b, in (-180, 180]. */
const signedGap = (a: number, b: number) => {
  const d = norm(a - b);
  return d > 180 ? d - 360 : d;
};
const sameBearing = (a: number, b: number) => Math.abs(signedGap(a, b)) < 1e-9;
const isSector = (arc: Arc | null): arc is Arc =>
  arc != null && norm(arc.to_deg - arc.from_deg) !== 0;

/** Which fixture a light belongs to, as mergeLanterns reads it. */
const fixtureOf = (l: PlacedLight) => `${l.sourceEntry}|${l.fx}|${l.z}`;

/** The divisions of every combined light, by key: each edge of its arc that
 *  another member of its fixture's arc starts or ends on. Uncombined lights,
 *  all-round lights and an edge no member shares get none. */
export function filamentDivisions(placed: readonly PlacedLight[]): Map<string, Division[]> {
  const out = new Map<string, Division[]>();
  for (const l of placed) {
    if (!l.combined || !isSector(l.arc)) continue;
    const arc = l.arc;
    const mates = placed.filter(
      (m) => m !== l && m.combined && isSector(m.arc) && fixtureOf(m) === fixtureOf(l),
    );
    const divisions: Division[] = [];
    if (mates.some((m) => sameBearing(m.arc!.to_deg, arc.from_deg)))
      divisions.push({ at: norm(arc.from_deg), inward: 1 });
    if (mates.some((m) => sameBearing(m.arc!.from_deg, arc.to_deg)))
      divisions.push({ at: norm(arc.to_deg), inward: -1 });
    if (divisions.length > 0) out.set(l.key, divisions);
  }
  return out;
}

/** The share 0..1 of the filament a viewer at `bearing` sees through this
 *  light's filter, when `bearing` is within `bleedDeg / 2` of one of its
 *  divisions; undefined elsewhere, where the light's own arc (and any sector
 *  profile) decides. 0.5 on the division itself. */
export function filamentShare(
  divisions: readonly Division[] | undefined,
  bearing: number,
  bleedDeg: number,
): number | undefined {
  if (!divisions || !(bleedDeg > 0)) return undefined;
  const half = bleedDeg / 2;
  for (const d of divisions) {
    const inside = d.inward * signedGap(bearing, d.at);
    if (Math.abs(inside) < half) return 0.5 + inside / bleedDeg;
  }
  return undefined;
}

/** How bright a combined light reads from `bearing`, 0..1, where its
 *  divisions decide: its filament share within the band, and a hard cut
 *  beyond it, on whichever side of the division `bearing` lies, while that
 *  division is the nearer edge of its arc. Undefined where the nearer edge
 *  is no division, or with no bleed: the caller's own rule (the hard cut or
 *  a §9 profile) decides there. */
export function filamentIntensity(
  divisions: readonly Division[] | undefined,
  arc: Arc | null,
  bearing: number,
  bleedDeg: number,
): number | undefined {
  if (!divisions || !(bleedDeg > 0) || !isSector(arc)) return undefined;
  const share = filamentShare(divisions, bearing, bleedDeg);
  if (share !== undefined) return share;
  const fromGap = Math.abs(signedGap(bearing, arc.from_deg));
  const toGap = Math.abs(signedGap(bearing, arc.to_deg));
  const nearer = norm(fromGap <= toGap ? arc.from_deg : arc.to_deg);
  if (!divisions.some((d) => sameBearing(d.at, nearer))) return undefined;
  return Number(norm(bearing - arc.from_deg) <= norm(arc.to_deg - arc.from_deg));
}
