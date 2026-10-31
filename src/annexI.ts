// Annex I heights and vertical separations, read from colregs geometry.json
// and laid over the hand-anchored placement. Only z moves; fx and py stay
// where the hull's anchors put them. Where geometry.json is silent for the
// vessel (a rule's `when` does not match, or no length is known) the hand
// anchor stands and the light carries no `basis`. With a length, every light
// at or above the datum carries `heightM`; one drawn below it carries none.
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

export function holds(when: Entry['when'], facts: FactRecord): boolean {
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
  // groups geometry.json keys by applicability entry
  const allRound = (l: PlacedLight) => l.lightId === 'light:all_round';
  const ofEntries = (entries: string[] | undefined) =>
    entries ? out.filter((l) => allRound(l) && entries.includes(l.sourceEntry)) : [];
  const anchorRule = rules.find((e) => e.cite === 'AnxI.2(k)');
  const fishingRule = rules.find((e) => e.cite === 'AnxI.2(j)');
  const gearRule = geometry.direction_indicating?.find((e) => e.cite === 'AnxI.4(a)');
  const obstructionRule = geometry.direction_indicating?.find((e) => e.cite === 'AnxI.4(b)');
  const anchors = ofEntries(anchorRule?.applies_to_entries).sort((a, b) => b.fx - a.fx);
  const gearLights = ofEntries(gearRule?.applies_to_entries);
  const sideOf = ofEntries(obstructionRule?.applies_to_entries);
  // 27(f): the foremast-head light and the two fore-yard lights placement.ts keys
  const mineHeads = out.filter((l) => allRound(l) && l.key.endsWith(':head'));
  const own = new Set([...anchors, ...gearLights, ...sideOf, ...mineHeads]);
  const column = out
    .filter(
      (l) =>
        allRound(l) &&
        l.fx === hull.mastX &&
        l.py === 0 &&
        !own.has(l) &&
        !l.key.includes(':yard-'),
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
    const below = (column.length - 1) * s;
    topM = Math.max(topM, lowestOk + below);
    // 4(b): the 27(d) pairs sit no higher than the lowest of the column, and
    // the pairs are themselves a 2(i) vertical line, so the column clears them
    const sideOfFloor = sideOf.length ? sideOfTopFloor(sideOf, s, towingLit, lowestMin) : null;
    const raisedForSides = sideOfFloor !== null && sideOfFloor + below > topM;
    if (raisedForSides) topM = sideOfFloor + below;
    // 2(j): the fishing pair's lower light at least twice the pair's spacing
    // above the sidelights (hand anchors: the 2(g) cap only lowers them)
    const fishing = fishingRule?.applies_to_entries?.includes(column[0].sourceEntry);
    const fishingFloor =
      fishing && sidelights.length && fishingRule?.min_multiple_of_pair_spacing !== undefined
        ? Math.max(...sidelights.map((l) => toM(l.z))) +
          fishingRule.min_multiple_of_pair_spacing * s
        : null;
    if (fishingFloor !== null) topM = Math.max(topM, fishingFloor + below);
    const moved = topM !== toM(column[0].z);
    column.forEach((l, i) => {
      l.z = toZ(topM - i * s);
      stamp(l);
      if (line) addBasis(l, spacingRule!.cite);
      else if (moved) addBasis(l, 'AnxI.2(f)(i)');
      if (raisedForSides) addBasis(l, obstructionRule!.cite);
      if (fishingFloor !== null) addBasis(l, fishingRule!.cite);
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

  // towing light in a vertical line above the sternlight (24(a)(iv), 2(i));
  // 2(i)'s lowest-light minimum is excepted where a towing light is required
  const stern = out.find((l) => l.lightId === 'light:sternlight' && !l.combined);
  if (s !== undefined && stern) {
    for (const l of out.filter((t) => t.lightId === 'light:towing')) {
      l.z = toZ(toM(stern.z) + s);
      addBasis(l, spacingRule!.cite);
      addBasis(stern, spacingRule!.cite);
    }
  }

  // 2(k): the forward anchor light at least 4.5 m above the after one, and
  // on a vessel of 50 m or more at least 6 m above the hull
  if (anchorRule && anchors.length >= 2) {
    const fore = anchors[0];
    const aft = anchors[anchors.length - 1];
    let lo = typeof anchorRule.min_m === 'number' ? toM(aft.z) + anchorRule.min_m : -Infinity;
    const also = anchorRule.also;
    if (typeof also === 'object' && typeof also.min_m === 'number' && holds(also.when, facts))
      lo = Math.max(lo, also.min_m);
    fore.z = toZ(Math.max(toM(fore.z), lo));
    addBasis(fore, anchorRule.cite);
    addBasis(aft, anchorRule.cite);
  }

  // 4(b): the 27(d) pairs, each a 2(i) line, the upper no higher than the
  // lowest light of the 27(b)(i) column
  if (sideOf.length && obstructionRule) {
    const floor = s === undefined ? -Infinity : sideOfTopFloor(sideOf, s, towingLit, lowestMin);
    const ceiling = column.length ? toM(column[column.length - 1].z) : Infinity;
    const topM = clamp(Math.max(...sideOf.map((l) => toM(l.z))), floor, ceiling);
    for (const pair of byColour(sideOf)) {
      pair.forEach((l, i) => {
        l.z = toZ(topM - i * (s ?? 0));
        addBasis(l, obstructionRule.cite);
        if (s !== undefined && pair.length > 1) addBasis(l, spacingRule!.cite);
      });
    }
  }

  // 4(a): the gear light no higher than the 26(c)(i) white (the column's
  // lower light) and no lower than the sidelights
  if (gearRule && gearLights.length) {
    const lo = sidelights.length ? Math.max(...sidelights.map((l) => l.z)) : -Infinity;
    const hi = column.length ? column[column.length - 1].z : Infinity;
    for (const l of gearLights) {
      l.z = clamp(l.z, lo, Math.max(lo, hi));
      addBasis(l, gearRule.cite);
    }
  }

  // 27(f): the foremast-head light stays below and clear of the forward
  // masthead light (2(f)(i)); the fore-yard lights keep their drop below it
  const mastLowZ = Math.min(...fwdMast.map((l) => l.z));
  if (fwdMast.length && s !== undefined) {
    for (const head of mineHeads) {
      const ceiling = mastLowZ - s / k;
      if (head.z <= ceiling) continue;
      const dz = ceiling - head.z;
      for (const l of out.filter(
        (y) => y === head || (y.sourceEntry === head.sourceEntry && y.key.includes(':yard-')),
      )) {
        l.z += dz;
        addBasis(l, 'AnxI.2(f)(i)');
      }
    }
  }

  // every light at or above the datum carries its height; one the drawing
  // puts below the deck line has no truthful height above the hull to show
  for (const l of out) {
    const m = toM(l.z);
    if (m >= -1e-9) l.heightM = Math.max(0, m);
    else delete l.heightM;
  }
  return out;
}

/** Lights grouped by colour, each group top-down. */
function byColour(lights: PlacedLight[]): PlacedLight[][] {
  const groups = new Map<string, PlacedLight[]>();
  for (const l of lights) groups.set(l.color, [...(groups.get(l.color) ?? []), l]);
  return [...groups.values()].map((g) => g.sort((a, b) => b.z - a.z));
}

/** The lowest height, in metres, the top of the 27(d) pairs may take: each
 * pair is a 2(i) vertical line, its lowest light held to 2(i)'s minimum. */
function sideOfTopFloor(
  sideOf: PlacedLight[],
  s: number,
  towingLit: boolean,
  lowestMin: number | undefined,
): number {
  const n = Math.max(...byColour(sideOf).map((g) => g.length));
  const lowest = n < 2 || towingLit || lowestMin === undefined ? -Infinity : lowestMin;
  return lowest + (n - 1) * s;
}
