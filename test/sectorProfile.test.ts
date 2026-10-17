// Annex I §9(a) sector-edge profiles and the §8 range dropout (#118).

import { describe, expect, it } from 'vitest';
import { ANNEX_I_PROFILE, rangeVisibility, sectorIntensity } from '../src/sectorProfile.js';

const masthead = { from_deg: 247.5, to_deg: 112.5 };
const starboard = { from_deg: 0, to_deg: 112.5 };
const port = { from_deg: 247.5, to_deg: 360 };
const stern = { from_deg: 112.5, to_deg: 247.5 };
const allRound = { from_deg: 0, to_deg: 360 };

describe('sectorIntensity, Annex I §9(a)', () => {
  it.each([
    ['deep inside', 60, 1],
    ['5° inside the aft limit', 107.5, 1],
    ['at the aft limit: half', 112.5, 0.5],
    ['2.5° outside the aft limit', 115, 0.25],
    ['5° outside the aft limit: cut off', 117.5, 0],
    ['at the forward limit: full', 0, 1],
    ['1° across the bow', 359, 0.5],
    ['2° across the bow: cut off', 358, 0],
  ])('starboard sidelight, %s', (_, bearing, want) => {
    expect(sectorIntensity(bearing, starboard)).toBeCloseTo(want, 6);
  });

  it('both sidelights show dead ahead, and only within the forward tail', () => {
    for (const b of [359, 0, 1]) {
      expect(sectorIntensity(b, starboard)).toBeGreaterThan(0);
      expect(sectorIntensity(b, port)).toBeGreaterThan(0);
    }
    expect(sectorIntensity(2, port)).toBe(0);
    expect(sectorIntensity(358, starboard)).toBe(0);
  });

  it('at 112.5° masthead, sidelight and sternlight all show, none at full', () => {
    for (const arc of [masthead, starboard, stern]) {
      expect(sectorIntensity(112.5, arc)).toBeCloseTo(0.5, 6);
    }
  });

  it('sternlight crosses over the masthead light symmetrically about 112.5°', () => {
    for (const d of [1, 2.5, 4]) {
      expect(sectorIntensity(112.5 + d, stern)).toBeCloseTo(
        sectorIntensity(112.5 - d, masthead),
        6,
      );
    }
  });

  it('an all-round or arc-less light is full from every bearing', () => {
    for (const b of [0, 112.5, 180, 359.9]) {
      expect(sectorIntensity(b, allRound)).toBe(1);
      expect(sectorIntensity(b, null)).toBe(1);
    }
  });

  it('a zero tail is a hard cut at the limit', () => {
    const hard = {
      forward: { inside: 0, atLimit: 1, outside: 0 },
      aft: { inside: 0, atLimit: 1, outside: 0 },
    };
    expect(sectorIntensity(112.5, starboard, hard)).toBe(1);
    expect(sectorIntensity(112.6, starboard, hard)).toBe(0);
  });

  it('the default is the Annex I envelope', () => {
    expect(ANNEX_I_PROFILE.forward.outside).toBeGreaterThanOrEqual(1);
    expect(ANNEX_I_PROFILE.forward.outside).toBeLessThanOrEqual(3);
    expect(ANNEX_I_PROFILE.aft.outside).toBeLessThanOrEqual(5);
    expect(ANNEX_I_PROFILE.aft.atLimit).toBeGreaterThanOrEqual(0.5);
  });
});

describe('rangeVisibility, Annex I §8', () => {
  it('a 1 nm sidelight is gone at 7 nm; glowProfile held it at 0.35', () => {
    expect(rangeVisibility(1, 7)).toBe(0);
  });

  it('a light is faint at its luminous range and full well inside it', () => {
    const atReach = rangeVisibility(3, 3);
    expect(atReach).toBeGreaterThan(0);
    expect(atReach).toBeLessThan(0.3);
    expect(rangeVisibility(3, 0.5)).toBe(1);
  });

  it('falls monotonically with range', () => {
    let last = 1;
    for (let d = 0.1; d < 8; d += 0.1) {
      const v = rangeVisibility(6, d);
      expect(v).toBeLessThanOrEqual(last + 1e-12);
      last = v;
    }
  });

  it('a 6 nm masthead outlasts a 2 nm sidelight at 4 nm', () => {
    expect(rangeVisibility(6, 4)).toBeGreaterThan(0.5);
    expect(rangeVisibility(2, 4)).toBe(0);
  });

  it('unknown reach or range leaves the light alone', () => {
    expect(rangeVisibility(undefined, 3)).toBe(1);
    expect(rangeVisibility(2, undefined)).toBe(1);
  });
});
