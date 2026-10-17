// The spec block's one promise: every light sits on it. A mesh is fitted to
// the spec's span but drawn by hand, so a light seated at a spec station can
// land off it; the block is built from those stations and must not.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { evaluateDisplay } from 'colregs-engine';
import type { DisplayEvaluation } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import { allHulls } from '../src/hulls.js';
import { lightsInView, placeLights } from '../src/placement.js';
import type { PlacedLight } from '../src/placement.js';
import { lightPosition, orbitPosition } from '../src/modelTransform.js';
import { blockTriangles, growPrism, insidePrism, specBlock } from '../src/specBlock.js';
import type { BlockPrism } from '../src/specBlock.js';
import { hullFacts } from '../playground/hullFacts.js';

const json = (id: string) =>
  JSON.parse(readFileSync(createRequire(import.meta.url).resolve(id), 'utf8')) as unknown;
const lightsData = json('colregs/data/lights.json') as LightsData;
const geometry = json('colregs/data/geometry.json') as GeometryData;

/** Every light any lawful display (and optional addition) of the hull's
 * gallery facts places on it. */
function everyLight(name: keyof typeof allHulls): {
  hull: (typeof allHulls)[keyof typeof allHulls];
  length: number;
  placed: PlacedLight[];
} {
  const hull = allHulls[name];
  const facts = hullFacts[name];
  const evaln: DisplayEvaluation = evaluateDisplay(facts);
  const extra = evaln.optionalAdditions.flatMap((a) => a.lights);
  return {
    hull,
    length: Number(facts['fact:length_m'] ?? 12),
    placed: evaln.displays.flatMap((d) =>
      placeLights([...d.lights, ...extra], hull.spec, facts, lightsData, geometry),
    ),
  };
}

/** The prism's outline as seen from relative bearing theta at tilt 0:
 * screen-right extent and height (orthographic). */
function seenFrom(prism: BlockPrism, theta: number) {
  const [ux, , uz] = orbitPosition(theta, 0, 1);
  const across = prism.outline.map(([x, z]) => x * uz - z * ux);
  return { left: Math.min(...across), right: Math.max(...across), prism };
}

const names = Object.keys(allHulls) as (keyof typeof allHulls)[];

describe('specBlock', () => {
  it.each(names)('%s: every light is inside the block', (name) => {
    const { hull, length, placed } = everyLight(name);
    const block = specBlock(hull.spec, placed, length);
    for (const l of placed) {
      const p = lightPosition(l, length);
      expect(
        block.some((b) => insidePrism(b, p)),
        `${l.key} at ${p.map((v) => v.toFixed(2))}`,
      ).toBe(true);
    }
  });

  it.each(names)('%s: every light in arc sits on the silhouette at 045, 090, 180', (name) => {
    const { hull, length, placed } = everyLight(name);
    const block = specBlock(hull.spec, placed, length);
    for (const theta of [45, 90, 180]) {
      const [ux, , uz] = orbitPosition(theta, 0, 1);
      const outlines = block.map((b) => seenFrom(b, theta));
      for (const l of lightsInView(placed, theta)) {
        const [x, y, z] = lightPosition(l, length);
        const u = x * uz - z * ux;
        const on = outlines.some(
          (o) => u >= o.left && u <= o.right && y >= o.prism.bottom && y <= o.prism.top,
        );
        expect(on, `${l.key} at ${theta}`).toBe(true);
      }
    }
  });

  it('stands on the waterline and spans the spec', () => {
    const spec = allHulls.powerSmall.spec;
    const [body] = specBlock(spec, [], 12);
    expect(body.bottom).toBe(0);
    const xs = body.outline.map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(spec.sternX * 6);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(spec.bowX * 6);
  });

  it('grows outward and keeps the body on the waterline', () => {
    const [body, mast] = specBlock(allHulls.tug.spec, [], 30);
    const grown = growPrism(body, 0.5);
    expect(grown.bottom).toBe(0);
    expect(grown.top).toBeCloseTo(body.top + 0.5);
    for (const [x, z] of body.outline) expect(insidePrism(grown, [x, 0.1, z])).toBe(true);
    expect(growPrism(mast, 0.5).bottom).toBeCloseTo(mast.bottom - 0.5);
  });

  it('winds every face outward', () => {
    const block = specBlock(allHulls.sailSmall.spec, [], 12);
    const tris = blockTriangles(block);
    expect(tris.length % 9).toBe(0);
    // A closed, outward-wound solid has a positive signed volume.
    let volume = 0;
    for (let i = 0; i < tris.length; i += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.slice(i, i + 9);
      volume +=
        (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    expect(volume).toBeGreaterThan(0);
  });
});
