// Annex I placement: heights and vertical separations come from colregs
// geometry.json, for every hull in the roster at every length band.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import type { DisplayLight, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import { metresPerZ } from '../src/annexI.js';
import { allHulls } from '../src/hulls.js';
import { placeLights, type PlacedLight } from '../src/placement.js';

const geometry = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve('colregs/data/geometry.json'), 'utf8'),
) as GeometryData;
const lightsData = { lights: {} } as unknown as LightsData;

const dl = (light: string, extra: Record<string, unknown> = {}, entry = 'test'): DisplayLight =>
  ({
    source_entry: entry,
    sourceEntry: entry,
    modality: 'modality:shall',
    spec: { light, ...extra },
  }) as unknown as DisplayLight;

const power = (length: number) =>
  ({ 'fact:propulsion': 'propulsion:power', 'fact:length_m': length }) as FactRecord;

// 23(a): masthead(s), sidelights, sternlight
const underway = [
  dl('light:masthead'),
  dl('light:masthead', { position: 'abaft and higher' }),
  dl('light:sidelights'),
  dl('light:sternlight'),
];
// 27(b)(i)-shaped column under a masthead light
const withColumn = [dl('light:masthead'), dl('light:all_round', { count: 3, color: 'red' })];

const lengths = [8, 15, 30, 100, 250];
const cases = Object.entries(allHulls).flatMap(([name, hull]) =>
  lengths.map((len) => [`${name} @ ${len} m`, hull, len] as const),
);

const metres = (l: PlacedLight, hull: (typeof allHulls)[keyof typeof allHulls], len: number) =>
  (l.z - hull.spec.sideLightZ) * metresPerZ(len);
const only = (ls: PlacedLight[], pred: (l: PlacedLight) => boolean) => ls.filter(pred);

describe('Annex I light placement, every hull', () => {
  it.each(cases)('%s: masthead height sits in its Annex I band', (_n, hull, len) => {
    const ls = placeLights(underway, hull.spec, power(len), lightsData, geometry);
    const fwd = only(ls, (l) => l.lightId === 'light:masthead' && l.fx === hull.spec.mastX)[0];
    const h = metres(fwd, hull, len);
    expect(fwd.heightM).toBeCloseTo(h, 6);
    if (len >= 20) {
      const breadth = hull.spec.beam * len;
      const lo = Math.min(Math.max(6, breadth), 12);
      expect(h).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(h).toBeLessThanOrEqual(12 + 1e-9);
      expect(fwd.basis).toContain('AnxI.2(a)(i)');
    } else if (len >= 12) {
      expect(h).toBeGreaterThanOrEqual(2.5 - 1e-9);
      expect(fwd.basis).toContain('AnxI.2(c)');
    } else {
      const sides = only(ls, (l) => l.lightId.startsWith('light:sidelight'));
      for (const s of sides) expect(h - metres(s, hull, len)).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(fwd.basis).toContain('AnxI.2(d)');
    }
  });

  it.each(cases)('%s: forward masthead lower than after, sidelights below 3/4', (_n, hull, len) => {
    const ls = placeLights(underway, hull.spec, power(len), lightsData, geometry);
    const fwd = only(ls, (l) => l.lightId === 'light:masthead' && l.fx === hull.spec.mastX)[0];
    const aft = only(ls, (l) => l.lightId === 'light:masthead' && l.fx === hull.spec.aftMastX)[0];
    if (len >= 20) {
      expect(metres(aft, hull, len) - metres(fwd, hull, len)).toBeGreaterThanOrEqual(4.5 - 1e-9);
      expect(aft.basis).toContain('AnxI.2(a)(ii)');
    }
    for (const s of only(ls, (l) => l.lightId.startsWith('light:sidelight'))) {
      expect(metres(s, hull, len)).toBeLessThanOrEqual(0.75 * metres(fwd, hull, len) + 1e-9);
      expect(s.basis).toContain('AnxI.2(g)');
    }
  });

  it.each(cases)(
    '%s: vertical all-rounds are spaced and clear below the masthead',
    (_n, hull, len) => {
      const ls = placeLights(withColumn, hull.spec, power(len), lightsData, geometry);
      const col = only(ls, (l) => l.lightId === 'light:all_round').sort((a, b) => b.z - a.z);
      const mast = only(ls, (l) => l.lightId === 'light:masthead')[0];
      const spacing = len >= 20 ? 2 : 1;
      const lowest = len >= 20 ? 4 : 2;
      expect(col).toHaveLength(3);
      for (let i = 1; i < col.length; i++) {
        // exactly the prescribed distance, in metres, scaled to the drawing
        expect((col[i - 1].z - col[i].z) * metresPerZ(len)).toBeCloseTo(spacing, 6);
      }
      expect(metres(col[2], hull, len)).toBeGreaterThanOrEqual(lowest - 1e-9);
      expect(metres(mast, hull, len) - metres(col[0], hull, len)).toBeGreaterThanOrEqual(
        spacing - 1e-9,
      );
      expect(col[0].basis).toContain(len >= 20 ? 'AnxI.2(i)(i)' : 'AnxI.2(i)(ii)');
    },
  );

  it.each(cases)('%s: fx and py stay on the hull anchors', (_n, hull, len) => {
    const a = placeLights(underway, hull.spec, power(len), lightsData);
    const b = placeLights(underway, hull.spec, power(len), lightsData, geometry);
    expect(b.map((l) => [l.key, l.fx, l.py])).toEqual(a.map((l) => [l.key, l.fx, l.py]));
  });
});

describe('Annex I fallbacks', () => {
  const hull = allHulls.powerLarge;
  it('a lone all-round is not a vertical line, so 2(i) is not cited or applied', () => {
    const ls = placeLights([dl('light:all_round')], hull.spec, power(30), lightsData, geometry);
    expect(ls[0].basis ?? []).not.toContain('AnxI.2(i)(i)');
    const a = placeLights([dl('light:all_round')], hull.spec, power(30), lightsData);
    expect(ls[0].z).toBe(a[0].z);
  });
  it('without geometry the hand anchors stand and nothing is labelled', () => {
    const ls = placeLights(underway, hull.spec, power(30), lightsData);
    expect(ls.every((l) => l.basis === undefined && l.heightM === undefined)).toBe(true);
  });
  it('without a length the hand anchors stand', () => {
    const facts = { 'fact:propulsion': 'propulsion:power' } as FactRecord;
    const a = placeLights(underway, hull.spec, facts, lightsData);
    expect(placeLights(underway, hull.spec, facts, lightsData, geometry)).toEqual(a);
  });
  it('a sailing vessel has no Annex I masthead rule, so its masthead keeps the hand anchor', () => {
    const facts = { 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 15 } as FactRecord;
    const a = placeLights(underway, allHulls.sailSmall.spec, facts, lightsData);
    const b = placeLights(underway, allHulls.sailSmall.spec, facts, lightsData, geometry);
    expect(b.map((l) => [l.key, l.fx, l.py, l.z, l.basis])).toEqual(
      a.map((l) => [l.key, l.fx, l.py, l.z, undefined]),
    );
  });
});

// The groups beyond the masthead, sidelights and column: each from its
// geometry.json entry, at every hull and length.
const spacingAt = (len: number) => (len >= 20 ? 2 : 1);
const lowestAt = (len: number) => (len >= 20 ? 4 : 2);
const spacingCite = (len: number) => (len >= 20 ? 'AnxI.2(i)(i)' : 'AnxI.2(i)(ii)');
const facts = (len: number, extra: Record<string, unknown>) =>
  ({ ...power(len), ...extra }) as FactRecord;

const towing = [
  dl('light:masthead', { count: 2 }),
  dl('light:sidelights'),
  dl('light:sternlight'),
  dl('light:towing', { position: 'in a vertical line above the sternlight' }),
];
const anchored = [
  dl('light:all_round', { position: 'in the fore part', color: 'white' }, 'rule:30a'),
  dl(
    'light:all_round',
    { position: 'at or near the stern, at a lower level than the fore one', color: 'white' },
    'rule:30a',
  ),
];
const dredging = [
  dl('light:masthead'),
  dl('light:sidelights'),
  dl('light:all_round', { position: 'upper', color: 'red' }, 'rule:27b_i'),
  dl('light:all_round', { position: 'middle', color: 'white' }, 'rule:27b_i'),
  dl('light:all_round', { position: 'lower', color: 'red' }, 'rule:27b_i'),
  dl(
    'light:all_round',
    { count: 2, color: 'red', position: 'on the side on which the obstruction exists' },
    'rule:27d',
  ),
  dl(
    'light:all_round',
    { count: 2, color: 'green', position: 'on the side on which another vessel may pass' },
    'rule:27d',
  ),
];
const mineClearing = [
  dl('light:masthead'),
  dl('light:sidelights'),
  dl(
    'light:all_round',
    { color: 'green', position: 'one near the foremast head and one at each end of the fore yard' },
    'rule:27f',
  ),
];
const fishingGear = [
  dl('light:all_round', { position: 'upper', color: 'red' }, 'rule:26c_i'),
  dl('light:all_round', { position: 'lower', color: 'white' }, 'rule:26c_i'),
  dl('light:sidelights'),
  dl('light:sternlight'),
  dl(
    'light:all_round',
    { position: 'in the direction of the gear', color: 'white' },
    'rule:26c_ii',
  ),
];

describe('Annex I placement of every light group, every hull', () => {
  it.each(cases)('%s: towing light 2(i) above the sternlight', (_n, hull, len) => {
    const f = facts(len, { 'fact:activity': 'activity:towing' });
    const ls = placeLights(towing, hull.spec, f, lightsData, geometry);
    const tow = only(ls, (l) => l.lightId === 'light:towing')[0];
    const stern = only(ls, (l) => l.lightId === 'light:sternlight')[0];
    expect((tow.z - stern.z) * metresPerZ(len)).toBeCloseTo(spacingAt(len), 6);
    expect(tow.basis).toContain(spacingCite(len));
    expect(stern.basis).toContain(spacingCite(len));
    expect([tow.fx, tow.py]).toEqual([stern.fx, stern.py]);
  });

  it.each(cases)('%s: 2(k) forward anchor light over the after one', (_n, hull, len) => {
    const f = facts(len, { 'fact:position': 'position:anchored' });
    const ls = placeLights(anchored, hull.spec, f, lightsData, geometry);
    const [fore, aft] = [...ls].sort((a, b) => b.fx - a.fx);
    expect(metres(fore, hull, len) - metres(aft, hull, len)).toBeGreaterThanOrEqual(4.5 - 1e-9);
    if (len >= 50) expect(metres(fore, hull, len)).toBeGreaterThanOrEqual(6 - 1e-9);
    for (const l of [fore, aft]) expect(l.basis).toContain('AnxI.2(k)');
  });

  it.each(cases)('%s: 27(d) pairs spaced, below the 27(b)(i) column (4(b))', (_n, hull, len) => {
    const f = facts(len, {
      'fact:activity': 'activity:ram_underwater',
      'fact:obstruction_side': 'obstruction_side:port',
    });
    const ls = placeLights(dredging, hull.spec, f, lightsData, geometry);
    const col = only(ls, (l) => l.sourceEntry === 'rule:27b_i').sort((a, b) => b.z - a.z);
    const mast = only(ls, (l) => l.lightId === 'light:masthead')[0];
    expect(col).toHaveLength(3);
    for (const colour of ['red', 'green']) {
      const pair = only(ls, (l) => l.sourceEntry === 'rule:27d' && l.color === colour).sort(
        (a, b) => b.z - a.z,
      );
      expect(pair).toHaveLength(2);
      expect((pair[0].z - pair[1].z) * metresPerZ(len)).toBeCloseTo(spacingAt(len), 6);
      expect(metres(pair[1], hull, len)).toBeGreaterThanOrEqual(lowestAt(len) - 1e-9);
      expect(pair[0].z).toBeLessThanOrEqual(col[2].z + 1e-12);
      for (const l of pair) expect(l.basis).toEqual(expect.arrayContaining(['AnxI.4(b)']));
    }
    expect(metres(mast, hull, len) - metres(col[0], hull, len)).toBeGreaterThanOrEqual(
      spacingAt(len) - 1e-9,
    );
  });

  it.each(cases)('%s: 27(f) lights below and clear of the masthead light', (_n, hull, len) => {
    const f = facts(len, { 'fact:activity': 'activity:mine' });
    const ls = placeLights(mineClearing, hull.spec, f, lightsData, geometry);
    const mast = only(ls, (l) => l.lightId === 'light:masthead')[0];
    const head = only(ls, (l) => l.key.endsWith(':head'))[0];
    const yards = only(ls, (l) => l.key.includes(':yard-'));
    const hand = placeLights(mineClearing, hull.spec, f, lightsData);
    const handHead = hand.find((l) => l.key === head.key)!;
    expect(metres(mast, hull, len) - metres(head, hull, len)).toBeGreaterThanOrEqual(
      spacingAt(len) - 1e-9,
    );
    expect(yards).toHaveLength(2);
    for (const y of yards) {
      const handYard = hand.find((l) => l.key === y.key)!;
      // the yard keeps its drawn drop below the head
      expect(head.z - y.z).toBeCloseTo(handHead.z - handYard.z, 9);
    }
    if (head.z !== handHead.z) expect(head.basis).toContain('AnxI.2(f)(i)');
  });

  it.each(cases)(
    '%s: 26(c)(ii) gear light between sidelights and white (4(a))',
    (_n, hull, len) => {
      const f = facts(len, { 'fact:activity': 'activity:fishing', 'fact:gear_extent_m': 200 });
      const ls = placeLights(fishingGear, hull.spec, f, lightsData, geometry);
      const gear = only(ls, (l) => l.sourceEntry === 'rule:26c_ii')[0];
      const white = only(ls, (l) => l.sourceEntry === 'rule:26c_i' && l.color === 'white')[0];
      const sideTop = Math.max(
        ...only(ls, (l) => l.lightId.startsWith('light:sidelight')).map((l) => l.z),
      );
      expect(gear.z).toBeGreaterThanOrEqual(sideTop - 1e-12);
      expect(gear.z).toBeLessThanOrEqual(white.z + 1e-12);
      expect(gear.basis).toContain('AnxI.4(a)');
      // 2(j): the white at least twice the pair's spacing above the sidelights
      expect((white.z - sideTop) * metresPerZ(len)).toBeGreaterThanOrEqual(
        2 * spacingAt(len) - 1e-9,
      );
      expect(white.basis).toContain('AnxI.2(j)');
    },
  );

  const displays = { underway, withColumn, towing, anchored, dredging, mineClearing, fishingGear };
  it.each(cases)('%s: heightM is the drawn height, never below the hull', (_n, hull, len) => {
    for (const d of Object.values(displays)) {
      for (const l of placeLights(d, hull.spec, power(len), lightsData, geometry)) {
        const m = metres(l, hull, len);
        if (m < -1e-9) expect(l.heightM, l.key).toBeUndefined();
        else expect(l.heightM, l.key).toBeCloseTo(m, 6);
      }
    }
  });
});
