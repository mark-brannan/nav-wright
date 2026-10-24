import { describe, expect, it } from 'vitest';
import {
  FLAT_HALO,
  HALO_OPACITY,
  HALO_RADIUS,
  HALO_SHELLS,
  haloProfile,
  haloShells,
} from '../src/halo.js';
import { glowProfile } from '../src/svg.js';

describe('haloProfile', () => {
  it('is the flat original at every default', () => {
    expect(haloProfile({})).toEqual(FLAT_HALO);
    expect(haloShells(haloProfile({}))).toEqual([{ radius: 2.6, opacity: 0.35 }]);
  });

  it('scales by glow size and by the range-scaled glow, as the flat view does', () => {
    const glow = glowProfile(6, 3);
    const p = haloProfile({ glowSize: 2, glow });
    expect(p.scale).toBeCloseTo(2 * glow.scale);
    expect(p.opacity).toBe(glow.opacity);
    expect(p.falloff).toBe(0);
  });

  it('haze widens up to three times and softens towards full falloff', () => {
    expect(haloProfile({ haze: 1 })).toEqual({ scale: 3, opacity: 1, falloff: 1 });
    const half = haloProfile({ haze: 0.5, glowFalloff: 0.5 });
    expect(half.scale).toBeCloseTo(2);
    expect(half.falloff).toBeCloseTo(0.75);
  });

  it('clamps nonsense', () => {
    expect(haloProfile({ glowSize: -1, glowFalloff: 3, haze: Number.NaN })).toEqual({
      scale: 0,
      opacity: 1,
      falloff: 1,
    });
  });
});

describe('haloShells', () => {
  it('draws one flat sphere at falloff 0', () => {
    expect(haloShells({ scale: 2, opacity: 0.5, falloff: 0 })).toEqual([
      { radius: HALO_RADIUS * 2, opacity: HALO_OPACITY * 0.5 },
    ]);
  });

  it('with falloff, nests shells that sum to the flat opacity at the centre', () => {
    const shells = haloShells({ scale: 1, opacity: 1, falloff: 1 });
    expect(shells).toHaveLength(HALO_SHELLS);
    expect(shells[0]!.radius).toBeCloseTo(HALO_RADIUS);
    const radii = shells.map((s) => s.radius);
    expect([...radii].sort((a, b) => b - a)).toEqual(radii);
    expect(shells.reduce((t, s) => t + s.opacity, 0)).toBeCloseTo(HALO_OPACITY);
    expect(shells.at(-1)!.radius).toBeCloseTo(HALO_RADIUS / HALO_SHELLS);
  });

  it('a small falloff keeps the shells near the edge', () => {
    const shells = haloShells({ scale: 1, opacity: 1, falloff: 0.2 });
    expect(shells.at(-1)!.radius).toBeGreaterThan(HALO_RADIUS * 0.8);
  });
});
