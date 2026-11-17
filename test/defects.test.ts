// Defect knobs (#117): a misaligned screen, a salted lens, a tired bulb.
// Each leaves today's picture at zero.

import { describe, expect, it } from 'vitest';
import {
  defectHalo,
  defectIntensity,
  MAX_SCREEN_SKEW,
  mixHex,
  screenArc,
  TIRED_WHITE,
} from '../src/defects.js';
import { FLAT_HALO } from '../src/halo.js';
import { bearingInArc } from '../src/placement.js';
import { ANNEX_I_PROFILE, sectorIntensity } from '../src/sectorProfile.js';
import type { PlacedLight } from '../src/placement.js';
import { LIGHT_COLORS } from '../src/svg.js';

const mk = (over: Partial<PlacedLight>): PlacedLight => ({
  key: 'k',
  lightId: 'light:masthead',
  color: 'white',
  character: 'steady',
  arc: { from_deg: 247.5, to_deg: 112.5 },
  fx: 0.12,
  py: 0,
  z: 0.98,
  sourceEntry: 'rule:23a',
  ...over,
});
const green = mk({
  lightId: 'light:sidelight_starboard',
  color: 'green',
  arc: { from_deg: 0, to_deg: 112.5 },
});
const red = mk({
  lightId: 'light:sidelight_port',
  color: 'red',
  arc: { from_deg: 247.5, to_deg: 360 },
});
const masthead = mk({});
const stern = mk({ lightId: 'light:sternlight', arc: { from_deg: 112.5, to_deg: 247.5 } });

describe('misaligned screen', () => {
  it('leaves every arc alone at zero', () => {
    for (const l of [green, red, masthead]) expect(screenArc(l, 0)).toBe(l.arc);
  });

  it('carries the starboard light across the bow to port for a positive skew', () => {
    const arc = screenArc(green, 6);
    expect(arc).toEqual({ from_deg: 354, to_deg: 112.5 });
    expect(bearingInArc(355, arc)).toBe(true);
    expect(bearingInArc(353, arc)).toBe(false);
    expect(screenArc(red, 6)).toBe(red.arc);
  });

  it('carries the port light across the bow to starboard for a negative skew', () => {
    const arc = screenArc(red, -6);
    expect(arc).toEqual({ from_deg: 247.5, to_deg: 6 });
    expect(bearingInArc(5, arc)).toBe(true);
    expect(bearingInArc(7, arc)).toBe(false);
    expect(screenArc(green, -6)).toBe(green.arc);
  });

  it.each([
    ['starboard, +6', green, 6, 354],
    ['port, −6', red, -6, 6],
  ] as const)('draws the moved edge with the forward profile (%s)', (_, light, skew, edge) => {
    const arc = screenArc(light, skew);
    const inward = skew > 0 ? 1 : -1;
    const fitted = (b: number) => sectorIntensity(b, arc, ANNEX_I_PROFILE, light.arc!);
    // Forward: full to the edge, a 2° tail outside it.
    expect(fitted(edge + inward * 0.5)).toBe(1);
    expect(fitted(edge)).toBe(1);
    expect(fitted(edge - inward * 1)).toBeCloseTo(0.5);
    expect(fitted(edge - inward * 2.5)).toBe(0);
    // Judged from the moved arc alone, it would take the aft taper.
    expect(sectorIntensity(edge + inward * 0.5, arc, ANNEX_I_PROFILE)).toBeLessThan(1);
  });

  it('keeps the aft edge where it was', () => {
    expect(bearingInArc(112.5, screenArc(green, 8))).toBe(true);
    expect(bearingInArc(113, screenArc(green, 8))).toBe(false);
  });

  it('leaves a combined lantern to its filament, and white lights alone', () => {
    const tri = { ...green, combined: true };
    expect(screenArc(tri, 6)).toBe(tri.arc);
    expect(screenArc(masthead, 6)).toBe(masthead.arc);
    expect(screenArc(stern, -6)).toBe(stern.arc);
  });

  it('clamps the skew to the slider', () => {
    expect(screenArc(green, 40)).toEqual({ from_deg: 360 - MAX_SCREEN_SKEW, to_deg: 112.5 });
  });
});

describe('salted lens and tired bulb', () => {
  it('leave brightness and halo as they were at zero', () => {
    for (const l of [green, red, masthead]) {
      expect(defectIntensity(l, 0, 0)).toBe(1);
      expect(defectHalo(l, FLAT_HALO, 0, 0)).toBe(FLAT_HALO);
    }
  });

  it('salt dims a sidelight and spreads and softens its halo, and no white light', () => {
    expect(defectIntensity(red, 1, 0)).toBeCloseTo(0.4);
    const halo = defectHalo(red, FLAT_HALO, 1, 0);
    expect(halo.scale).toBeCloseTo(2.5);
    expect(halo.falloff).toBe(1);
    expect(halo.color).toBeUndefined();
    expect(defectIntensity(masthead, 1, 0)).toBe(1);
    expect(defectHalo(masthead, FLAT_HALO, 1, 0)).toBe(FLAT_HALO);
  });

  it('a tired bulb dims and yellows every white light, and no coloured one', () => {
    expect(defectIntensity(masthead, 0, 1)).toBeCloseTo(0.4);
    expect(defectHalo(stern, FLAT_HALO, 0, 1).color).toBe(TIRED_WHITE);
    expect(defectHalo(masthead, FLAT_HALO, 0, 0.5).color).toBe(
      mixHex(LIGHT_COLORS.white!, TIRED_WHITE, 0.5),
    );
    expect(defectIntensity(green, 0, 1)).toBe(1);
    expect(defectHalo(green, FLAT_HALO, 0, 1)).toBe(FLAT_HALO);
  });

  it('clamps both to 0..1', () => {
    expect(defectIntensity(red, 5, 0)).toBeCloseTo(0.4);
    expect(defectIntensity(masthead, 0, -2)).toBe(1);
  });
});

describe('mixHex', () => {
  it('runs channel by channel from one colour to the other', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ff8000', 0.5)).toBe('#804000');
  });
});
