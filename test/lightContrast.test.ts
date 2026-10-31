// Rule 21's four light colours as text on the night ground: each reaches
// WCAG 2.x AA for normal text (4.5:1) against the grounds text sits on at
// night — the stylesheet's --sea-night (the profile, plan, scene and tow
// views, whose labels sit on it) and the bearing view's black sky, where its
// empty-scene note sits. Chromaticity is lightColours.test.ts's job.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skyColor } from '../src/BearingView.js';
import { LIGHT_COLORS } from '../src/svg.js';

const AA_NORMAL_TEXT = 4.5;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const seaNight = /--sea-night:\s*(#[0-9a-fA-F]{6})\s*;/.exec(css)?.[1];

const GROUNDS: [string, string][] = [
  ['--sea-night', seaNight ?? ''],
  ['the bearing view black sky', skyColor(0)],
];

describe('light colours as text on the night ground (WCAG AA)', () => {
  it('reads the grounds', () => {
    expect(seaNight).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(skyColor(0)).toBe('#000000');
    expect(Object.keys(LIGHT_COLORS).sort()).toEqual(['green', 'red', 'white', 'yellow']);
  });

  it('checks contrast the WCAG way', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 6);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  describe.each(GROUNDS)('on %s (%s)', (_name, ground) => {
    it.each(Object.entries(LIGHT_COLORS))('%s %s reaches 4.5:1', (_light, fill) => {
      expect(contrast(fill, ground)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  });
});
