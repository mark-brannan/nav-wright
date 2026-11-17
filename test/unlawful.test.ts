// Unlawful display presets (#117 item 5): reversed sidelights, and one light
// of a kind with the others out, applied to the lights a rule calls for.

import { describe, expect, it } from 'vitest';
import { applyUnlawful, UNLAWFUL_PRESETS, unlawfulPreset } from '../src/unlawful.js';
import { bearingInArc } from '../src/placement.js';
import type { PlacedLight } from '../src/placement.js';

const mk = (over: Partial<PlacedLight>): PlacedLight => ({
  key: over.key ?? 'k',
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
  key: 'green',
  lightId: 'light:sidelight_starboard',
  color: 'green',
  arc: { from_deg: 0, to_deg: 112.5 },
  py: 0.3,
  z: 0.5,
});
const red = mk({
  key: 'red',
  lightId: 'light:sidelight_port',
  color: 'red',
  arc: { from_deg: 247.5, to_deg: 360 },
  py: -0.3,
  z: 0.5,
});
const mastFwd = mk({ key: 'mast-fwd', fx: 0.3, z: 0.8 });
const mastAft = mk({ key: 'mast-aft', fx: -0.2, z: 1.1 });
const stern = mk({
  key: 'stern',
  lightId: 'light:sternlight',
  arc: { from_deg: 112.5, to_deg: 247.5 },
  z: 0.4,
});
const allRound = (key: string, color: string, z: number) =>
  mk({ key, lightId: 'light:all_round', color, arc: { from_deg: 0, to_deg: 360 }, z });

// Rule 23(a)(ii): two masthead lights, sidelights, a sternlight.
const powerOver50 = [mastFwd, mastAft, green, red, stern];

const shownFrom = (lights: PlacedLight[], theta: number) =>
  lights.filter((l) => l.arc && bearingInArc(theta, l.arc)).map((l) => l.color);

describe('unlawful presets', () => {
  it('has a preset id for every entry, and none changes nothing', () => {
    expect(new Set(UNLAWFUL_PRESETS.map((p) => p.id)).size).toBe(UNLAWFUL_PRESETS.length);
    expect(applyUnlawful(powerOver50, 'none')).toBe(powerOver50);
    expect(applyUnlawful(powerOver50, 'no-such-preset')).toBe(powerOver50);
    expect(unlawfulPreset('no-such-preset')).toBeUndefined();
  });

  describe('reversed sidelights', () => {
    const shown = applyUnlawful(powerOver50, 'reversed-sidelights');

    it('shows red on the starboard bow and green on the port bow', () => {
      expect(shownFrom(shown, 45)).toContain('red');
      expect(shownFrom(shown, 45)).not.toContain('green');
      expect(shownFrom(shown, 315)).toContain('green');
      expect(shownFrom(shown, 315)).not.toContain('red');
    });

    it('keeps each lantern where it is fitted: side, arc and height', () => {
      const stbd = shown.find((l) => l.key === 'green')!;
      expect(stbd).toEqual({ ...green, color: 'red' });
      expect(shown.find((l) => l.key === 'red')).toEqual({ ...red, color: 'green' });
    });

    it('leaves every other light as it is', () => {
      for (const l of [mastFwd, mastAft, stern]) expect(shown).toContain(l);
    });

    it('reverses a combined lantern too', () => {
      const bi = [
        { ...green, combined: true },
        { ...red, combined: true },
      ];
      expect(applyUnlawful(bi, 'reversed-sidelights').map((l) => l.color)).toEqual([
        'red',
        'green',
      ]);
    });

    it('changes nothing for a display without sidelights', () => {
      const anchored = [allRound('a', 'white', 1), allRound('b', 'white', 0.4)];
      expect(applyUnlawful(anchored, 'reversed-sidelights')).toBe(anchored);
    });
  });

  describe('one light of a kind', () => {
    it('drops the lower of two masthead lights', () => {
      const shown = applyUnlawful(powerOver50, 'one-of-a-kind');
      expect(shown.map((l) => l.key)).toEqual(['mast-aft', 'green', 'red', 'stern']);
    });

    it('keeps the top of a vertical line of all-round lights of one colour', () => {
      // Rule 27(b)(i): red, white, red in a vertical line.
      const ram = [
        allRound('r1', 'red', 1.2),
        allRound('w', 'white', 1.0),
        allRound('r2', 'red', 0.8),
      ];
      expect(applyUnlawful(ram, 'one-of-a-kind').map((l) => l.key)).toEqual(['r1', 'w']);
    });

    it('keeps the first of two at the same height', () => {
      const yards = [allRound('s', 'green', 1), allRound('p', 'green', 1)];
      expect(applyUnlawful(yards, 'one-of-a-kind').map((l) => l.key)).toEqual(['s']);
    });

    it('changes nothing where every kind is shown once', () => {
      const under50 = [mastFwd, green, red, stern];
      expect(applyUnlawful(under50, 'one-of-a-kind')).toBe(under50);
    });
  });
});
