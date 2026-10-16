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

const dl = (light: string, extra: Record<string, unknown> = {}): DisplayLight =>
  ({
    source_entry: 'test',
    sourceEntry: 'test',
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
    expect(placeLights(underway, allHulls.sailSmall.spec, facts, lightsData, geometry)).toEqual(a);
  });
});
