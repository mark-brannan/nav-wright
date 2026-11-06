// Annex I §5 filament bleed: a combined lantern's colours share the filament
// across each division, and nothing else changes.

import { describe, expect, it } from 'vitest';
import { evaluateSignals } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { LightsData } from 'colregs-engine/schema';
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { filamentDivisions, filamentIntensity, filamentShare } from '../src/filament.js';
import { selectHull } from '../src/hulls.js';
import { placeLights } from '../src/placement.js';
import type { PlacedLight } from '../src/placement.js';

const lightsData = lightsJson as unknown as LightsData;

const mk = (over: Partial<PlacedLight>): PlacedLight => ({
  key: 'k',
  lightId: 'light:masthead',
  color: 'white',
  character: 'steady',
  arc: null,
  fx: 0.12,
  py: 0,
  z: 0.98,
  sourceEntry: 'rule:25b',
  ...over,
});
const green = mk({
  key: 'g',
  color: 'green',
  arc: { from_deg: 0, to_deg: 112.5 },
  combined: true,
});
const red = mk({ key: 'r', color: 'red', arc: { from_deg: 247.5, to_deg: 360 }, combined: true });
const white = mk({
  key: 'w',
  color: 'white',
  arc: { from_deg: 112.5, to_deg: 247.5 },
  combined: true,
});
const tricolour = [green, red, white];

const shares = (placed: PlacedLight[], bearing: number, bleed: number) => {
  const d = filamentDivisions(placed);
  return Object.fromEntries(
    placed.map((l) => [l.color, filamentShare(d.get(l.key), bearing, bleed)]),
  );
};

describe('filamentDivisions', () => {
  it('finds both edges of every tricolour member', () => {
    const d = filamentDivisions(tricolour);
    expect(d.get('g')).toEqual([
      { at: 0, inward: 1 },
      { at: 112.5, inward: -1 },
    ]);
    expect(d.get('r')).toEqual([
      { at: 247.5, inward: 1 },
      { at: 0, inward: -1 },
    ]);
    expect(d.get('w')).toEqual([
      { at: 112.5, inward: 1 },
      { at: 247.5, inward: -1 },
    ]);
  });

  it('leaves an edge no member shares, and every uncombined light', () => {
    const pair = filamentDivisions([green, red]);
    expect(pair.get('g')).toEqual([{ at: 0, inward: 1 }]);
    expect(pair.get('r')).toEqual([{ at: 0, inward: -1 }]);
    const apart = [green, red, white].map((l) => ({ ...l, combined: undefined }));
    expect(filamentDivisions(apart).size).toBe(0);
  });

  it('keeps fixtures apart: members of another lantern share no division', () => {
    const lower = { ...white, key: 'w2', z: 0.5 };
    expect(filamentDivisions([green, red, lower]).get('g')).toEqual([{ at: 0, inward: 1 }]);
  });

  it('finds Rule 25(b) as colregs places it', () => {
    const facts = {
      'fact:propulsion': 'propulsion:sail',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:making_way': true,
      'fact:length_m': 12,
    } as FactRecord;
    const display = evaluateSignals(facts).displays.find((d: { entries: string[] }) =>
      d.entries.includes('rule:25b'),
    )!;
    const placed = placeLights(display.lights, selectHull(facts).spec, facts, lightsData);
    const d = filamentDivisions(placed);
    expect(d.size).toBe(3);
    for (const l of placed) expect(d.get(l.key)).toHaveLength(2);
  });
});

describe('filamentShare', () => {
  it('splits the filament evenly on each division', () => {
    expect(shares(tricolour, 0, 4)).toEqual({ green: 0.5, red: 0.5, white: undefined });
    expect(shares(tricolour, 112.5, 4)).toEqual({ green: 0.5, red: undefined, white: 0.5 });
    expect(shares(tricolour, 247.5, 4)).toEqual({ green: undefined, red: 0.5, white: 0.5 });
  });

  it('runs linearly across the band, and the two shares sum to one', () => {
    for (const [b, g] of [
      [-2, 0],
      [-1, 0.25],
      [359.5, 0.375],
      [1, 0.75],
    ] as const) {
      const s = shares(tricolour, b, 4);
      if (g === 0) {
        // the band's edge: the arcs decide, as without bleed
        expect(s.green).toBeUndefined();
        continue;
      }
      expect(s.green).toBeCloseTo(g);
      expect(s.green! + s.red!).toBeCloseTo(1);
    }
    const aft = shares(tricolour, 113.5, 4);
    expect(aft.white).toBeCloseTo(0.75);
    expect(aft.green! + aft.white!).toBeCloseTo(1);
  });

  it('leaves the arcs to decide outside the band, and everywhere at 0', () => {
    expect(shares(tricolour, 45, 4)).toEqual({
      green: undefined,
      red: undefined,
      white: undefined,
    });
    expect(shares(tricolour, 3, 4).green).toBeUndefined();
    for (const b of [0, 112.5, 1]) {
      expect(shares(tricolour, b, 0)).toEqual({
        green: undefined,
        red: undefined,
        white: undefined,
      });
    }
    expect(filamentShare(undefined, 0, 4)).toBeUndefined();
    expect(filamentShare([{ at: 0, inward: 1 }], 0, Number.NaN)).toBeUndefined();
  });
});

describe('filamentIntensity', () => {
  const d = filamentDivisions(tricolour);
  const at = (l: PlacedLight, b: number, bleed = 4) =>
    filamentIntensity(d.get(l.key), l.arc, b, bleed);

  it('is the share in the band and a hard cut beyond it', () => {
    expect(at(green, 1)).toBeCloseTo(0.75);
    expect(at(green, 3)).toBe(1);
    expect(at(green, 357)).toBe(0);
    expect(at(white, 115)).toBe(1);
    expect(at(green, 115)).toBe(0);
    expect(at(red, 250)).toBe(1);
    expect(at(white, 250)).toBe(0);
  });

  it('leaves an edge no member shares to the caller', () => {
    const pair = filamentDivisions([green, red]);
    expect(filamentIntensity(pair.get('g'), green.arc, 110, 4)).toBeUndefined();
    expect(filamentIntensity(pair.get('g'), green.arc, 115, 4)).toBeUndefined();
    expect(filamentIntensity(pair.get('g'), green.arc, 20, 4)).toBe(1);
  });

  it('does nothing with no bleed', () => {
    expect(at(green, 1, 0)).toBeUndefined();
    expect(at(green, 357, 0)).toBeUndefined();
  });
});
