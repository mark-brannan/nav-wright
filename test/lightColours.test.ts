// Annex I §7: the four light colours are checked against the CIE 2.2 (1975)
// chromaticity polygons in colregs geometry.json, and the 3D path draws the
// same colours as the SVG views.
//
// sRGB cannot reach every polygon: red and yellow lie outside its gamut, so
// for those the shipped colour is the nearest sRGB point and the test bounds
// its distance from the polygon. White and green must lie inside.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { LIGHT_COLORS, lightFill } from '../src/svg.js';

type XY = [number, number];
const corners = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve('colregs/data/geometry.json'), 'utf8'),
).colors.chromaticity_corners as Record<string, { x: number[]; y: number[] }>;
const polygon = (name: string): XY[] => corners[name]!.x.map((x, i) => [x, corners[name]!.y[i]!]);

function xyOfHex(hex: string): XY {
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const [r, g, b] = lin;
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  return [X / (X + Y + Z), Y / (X + Y + Z)];
}

function inside(p: XY, pts: XY[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function distance(p: XY, pts: XY[]): number {
  if (inside(p, pts)) return 0;
  return Math.min(
    ...pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
      );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    }),
  );
}

describe('Annex I §7 light chromaticity', () => {
  it('has the four colours, in colregs data', () => {
    expect(Object.keys(LIGHT_COLORS).sort()).toEqual(['green', 'red', 'white', 'yellow']);
    expect(Object.keys(corners).sort()).toEqual(['green', 'red', 'white', 'yellow']);
  });

  it.each(['white', 'green'])('%s lies inside its polygon', (name) => {
    expect(inside(xyOfHex(lightFill(name)), polygon(name))).toBe(true);
  });

  it.each(['red', 'yellow'])('%s is the nearest sRGB point to its out-of-gamut polygon', (name) => {
    expect(distance(xyOfHex(lightFill(name)), polygon(name))).toBeLessThan(0.025);
  });

  it('the four colours are told apart by chromaticity', () => {
    const pts = Object.keys(LIGHT_COLORS).map((n) => xyOfHex(lightFill(n)));
    for (const [i, a] of pts.entries())
      for (const b of pts.slice(i + 1))
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(0.08);
  });

  it('the 3D view draws lights through lightFill, not CSS names', () => {
    const src = readFileSync(new URL('../src/BenchyModel.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/color=\{light\.color\}/);
    expect(src.match(/color=\{lightFill\(light\.color\)\}/g)).toHaveLength(2);
  });
});
