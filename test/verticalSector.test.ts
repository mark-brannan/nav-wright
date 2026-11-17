// Annex I §10 vertical sectors: the figures (hand-typed until colregs#228's
// data reaches nav-wright), the paragraph her facts call for, the fall with
// elevation, and the viewer's elevation from tilt and heel.

import { describe, expect, it } from 'vitest';
import {
  lightElevation,
  VERTICAL_SECTORS,
  verticalIntensity,
  verticalSectorFor,
} from '../src/verticalSector.js';

const sailing = {
  'fact:propulsion': 'propulsion:sail',
  'fact:position': 'position:underway',
} as const;
const power = {
  'fact:propulsion': 'propulsion:power',
  'fact:position': 'position:underway',
} as const;
const a = VERTICAL_SECTORS.find((e) => e.cite === 'AnxI.10(a)')!;
const b = VERTICAL_SECTORS.find((e) => e.cite === 'AnxI.10(b)')!;

describe('verticalSectorFor', () => {
  it('is §10(b) for a sailing vessel underway', () => {
    expect(verticalSectorFor(sailing)).toBe(b);
  });

  it('is §10(a) for a power vessel, a sailing vessel at anchor, and no facts', () => {
    expect(verticalSectorFor(power)).toBe(a);
    expect(verticalSectorFor({ ...sailing, 'fact:position': 'position:anchored' })).toBe(a);
    expect(verticalSectorFor({})).toBe(a);
  });
});

describe('verticalIntensity', () => {
  it.each([
    [a, 0, 1],
    [a, 5, 1],
    [a, -5, 1],
    [a, 6.25, 0.8],
    [a, 7.5, 0.6],
    [a, -7.5, 0.6],
    [a, 14, 0],
    [a, 90, 0],
    [b, 5, 1],
    [b, 15, 0.75],
    [b, 25, 0.5],
    [b, -25, 0.5],
    [b, 32.5, 0.25],
    [b, 40, 0],
  ])('%#: at %s° reads %s', (entry, elevation, expected) => {
    expect(verticalIntensity(elevation, entry)).toBeCloseTo(expected, 9);
  });

  it('meets each band minimum §10 sets', () => {
    for (const entry of VERTICAL_SECTORS) {
      for (const band of entry.bands) {
        for (let e = -band.within_deg; e <= band.within_deg; e += 0.25) {
          expect(verticalIntensity(e, entry)).toBeGreaterThanOrEqual(band.min_fraction - 1e-12);
        }
      }
    }
  });

  it('never rises with elevation', () => {
    for (const entry of VERTICAL_SECTORS) {
      let last = 1;
      for (let e = 0; e <= 90; e += 0.5) {
        const v = verticalIntensity(e, entry);
        expect(v).toBeLessThanOrEqual(last + 1e-12);
        last = v;
      }
    }
  });
});

describe('lightElevation', () => {
  it('is the tilt when she is upright, from any bearing', () => {
    for (const theta of [0, 45, 90, 180, 270]) {
      expect(lightElevation(theta, 10)).toBeCloseTo(10, 9);
      expect(lightElevation(theta, -30)).toBeCloseTo(-30, 9);
    }
  });

  it('adds a starboard heel on her starboard beam and takes it on her port beam', () => {
    expect(lightElevation(90, 0, 20)).toBeCloseTo(20, 9);
    expect(lightElevation(270, 0, 20)).toBeCloseTo(-20, 9);
    expect(lightElevation(90, 10, 20)).toBeCloseTo(30, 9);
    expect(lightElevation(270, 10, 20)).toBeCloseTo(-10, 9);
  });

  it('is untouched by heel dead ahead and dead astern at the waterline', () => {
    expect(lightElevation(0, 0, 25)).toBeCloseTo(0, 9);
    expect(lightElevation(180, 0, 25)).toBeCloseTo(0, 9);
  });

  it('flattens a tilt dead ahead by the cosine of the heel', () => {
    expect(Math.sin((lightElevation(0, 10, 25) * Math.PI) / 180)).toBeCloseTo(
      Math.sin((10 * Math.PI) / 180) * Math.cos((25 * Math.PI) / 180),
      12,
    );
  });

  it('is straight down from overhead whatever the bearing', () => {
    expect(lightElevation(0, 90)).toBeCloseTo(90, 9);
    expect(lightElevation(123, 90)).toBeCloseTo(90, 9);
  });
});
