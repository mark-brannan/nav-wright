// Annex I heights and vertical separations, read from colregs geometry.json
// and laid over the hand-anchored placement. Only z moves; fx and py stay
// where the hull's anchors put them. Where geometry.json is silent for the
// vessel (a rule's `when` does not match, or no length is known) the hand
// anchor stands and the light carries no `basis`.
//
// Units. A light's z is a fraction of the half-length scaled by
// LIGHT_Z_TO_X, so one z unit is (length / 2) * LIGHT_Z_TO_X metres: the
// same scale lightPosition() uses for the 3D scene. The hull datum for
// "above the hull" and "above the gunwale" is the drawn deck line,
// hull.sideLightZ.

import type { FactRecord } from 'colregs-engine';
import type { GeometryData } from 'colregs-engine/schema';
import type { HullSpec } from './hulls.js';
import { LIGHT_Z_TO_X } from './modelTransform.js';
import type { PlacedLight } from './placement.js';

type Entry = GeometryData['vertical_positioning'][number];

function holds(when: Entry['when'], facts: FactRecord): boolean {
  if (!when) return true;
  return Object.entries(when).every(([fact, want]) => {
    const have = facts[fact as keyof FactRecord] as unknown;
    if (have === undefined) return false;
    if (typeof want === 'string') return have === want;
    if (typeof want === 'boolean') return have === want;
    if (Array.isArray(want)) return want.includes(have as string);
    if (typeof have !== 'number') return false;
    const w = want;
    return (
      (w.gte === undefined || have >= w.gte) &&
      (w.gt === undefined || have > w.gt) &&
      (w.lte === undefined || have <= w.lte) &&
      (w.lt === undefined || have < w.lt)
    );
  });
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

const addBasis = (l: PlacedLight, ...cites: string[]) => {
  l.basis = [...new Set([...(l.basis ?? []), ...cites])];
};

/** Metres per z unit for a vessel of this length. */
export function metresPerZ(lengthM: number): number {
  return (lengthM / 2) * LIGHT_Z_TO_X;
}

export function applyAnnexI(
  lights: PlacedLight[],
  hull: HullSpec,
  facts: FactRecord,
  geometry: GeometryData,
): PlacedLight[] {
  const length = facts['fact:length_m'];
  if (typeof length !== 'number' || !(length > 0)) return lights;

  const out = lights.map((l) => ({ ...l }));
  const k = metresPerZ(length);
  const deckZ = hull.sideLightZ;
  const toM = (z: number) => (z - deckZ) * k;
  const toZ = (m: number) => deckZ + m / k;
  const stamp = (l: PlacedLight) => {
    l.heightM = toM(l.z);
  };

  const rules = geometry.vertical_positioning.filter((e) => holds(e.when, facts));
  const rule = (cite: string) => rules.find((e) => e.cite === cite);
  const power = facts['fact:propulsion'] === 'propulsion:power';

  const byZDesc = (a: PlacedLight, b: PlacedLight) => b.z - a.z;
  const fwdMast = out
    .filter((l) => l.lightId === 'light:masthead' && l.fx === hull.mastX)
    .sort(byZDesc);
  const aftMast = out.filter(
    (l) => l.lightId === 'light:masthead' && l.fx === hull.aftMastX && l.fx !== hull.mastX,
  );
  const column = out
    .filter(
      (l) =>
        l.lightId === 'light:all_round' &&
        l.fx === hull.mastX &&
        l.py === 0 &&
        !l.key.includes(':head'),
    )
    .sort(byZDesc);
  const sidelights = out.filter((l) => l.lightId.startsWith('light:sidelight') && !l.combined);
  const combinedSides = out.filter((l) => l.lightId.startsWith('light:sidelight') && l.combined);
  const towingLit = out.some((l) => l.lightId === 'light:towing');

  // vertical line spacing (2(i)): applies by length, to every vessel
  const spacingRule = rule('AnxI.2(i)(i)') ?? rule('AnxI.2(i)(ii)');
  const s = spacingRule?.min_spacing_m;
  const lowestMin = spacingRule?.lowest_light?.min_m;

  // forward masthead height (2(a)(i), 2(c), 2(d)), power-driven vessels
  const mastRule = power
    ? (rule('AnxI.2(a)(i)') ?? rule('AnxI.2(c)') ?? rule('AnxI.2(d)'))
    : undefined;
  let mastTopM: number | null = null;
  let mastCites: string[] = [];
  if (mastRule && fwdMast.length) {
    const breadth = hull.beam * length; // half-beam is in half-length units
    let lo = typeof mastRule.min_m === 'number' ? mastRule.min_m : 0;
    if (mastRule.cite === 'AnxI.2(a)(i)' && breadth > lo) lo = breadth; // "not less than such breadth"
    const hi = mastRule.max_m ?? Infinity;
    lo = Math.min(lo, hi);
    const sideTop = Math.max(0, ...sidelights.map((l) => toM(l.z)));
    if (mastRule.min_above_sidelights_m !== undefined && sidelights.length)
      lo = Math.max(lo, sideTop + mastRule.min_above_sidelights_m);
    mastTopM = clamp(toM(fwdMast[0].z), lo, hi);
    mastCites = [mastRule.cite];
  }

  // the vertical column of all-rounds
  if (s !== undefined && column.length) {
    let topM = toM(column[0].z);
    if (mastTopM !== null) {
      const mastLow = mastTopM - (fwdMast.length - 1) * s;
      topM = Math.min(topM, mastLow - s);
    }
    // 2(i) governs lights "in a vertical line": two or three. A lone
    // all-round (23(d)(i), 30(b)) only has to stay clear below the masthead.
    const line = column.length >= 2;
    const lowestOk = !line || towingLit || lowestMin === undefined ? -Infinity : lowestMin;
    topM = Math.max(topM, lowestOk + (column.length - 1) * s);
    const moved = topM !== toM(column[0].z);
    column.forEach((l, i) => {
      l.z = toZ(topM - i * s);
      stamp(l);
      if (line) addBasis(l, spacingRule!.cite);
      else if (moved) addBasis(l, 'AnxI.2(f)(i)');
    });
    if (mastTopM !== null) {
      // 2(f)(i): masthead lights above and clear of every other light
      const mastLow = mastTopM - (fwdMast.length - 1) * s;
      if (mastLow < topM + s) {
        mastTopM += topM + s - mastLow;
        mastCites.push('AnxI.2(f)(i)');
      }
    }
  }

  if (mastTopM !== null) {
    const step = s ?? 0;
    fwdMast.forEach((l, i) => {
      l.z = toZ(mastTopM! - i * step);
      stamp(l);
      addBasis(
        l,
        ...mastCites,
        ...(s !== undefined && fwdMast.length > 1 ? [spacingRule!.cite] : []),
      );
    });
  }

  // after masthead light 4.5 m above the forward one (2(a)(ii))
  const afterRule = rule('AnxI.2(a)(ii)');
  if (afterRule && typeof afterRule.min_m === 'number') {
    const ref = mastTopM ?? (mastRule ? toM(hull.mastTopZ) : null);
    for (const l of aftMast) {
      const m = Math.max(toM(l.z), (ref ?? toM(hull.mastTopZ)) + afterRule.min_m);
      l.z = toZ(m);
      stamp(l);
      addBasis(l, afterRule.cite);
    }
  }

  // sidelights no higher than three quarters of the forward masthead (2(g))
  const sideRule = rule('AnxI.2(g)');
  if (sideRule?.max_fraction_of_masthead_height !== undefined && mastTopM !== null) {
    const cap = sideRule.max_fraction_of_masthead_height * mastTopM;
    for (const l of sidelights) {
      l.z = Math.min(l.z, toZ(cap));
      stamp(l);
      addBasis(l, sideRule.cite);
    }
  }
  // a combined lantern sits at least 1 m below the masthead light (2(h))
  const lanternRule = rule('AnxI.2(h)');
  if (lanternRule?.min_below_m !== undefined && mastTopM !== null) {
    for (const l of combinedSides) {
      l.z = Math.min(l.z, toZ(mastTopM - lanternRule.min_below_m));
      stamp(l);
      addBasis(l, lanternRule.cite);
    }
  }
  return out;
}
