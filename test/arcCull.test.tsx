// The 3D bearing view must hide a light whenever the viewer stands outside
// its arc, exactly as the SVG bearing view does. Both cull through
// lightsInView; these sweeps hold each view to the arc, light type by
// light type, and hold the two views to each other at every whole degree.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BearingScene } from '../src/BearingView.js';
import { selectHull } from '../src/hulls.js';
import { seatsSeenFrom } from '../src/modelTransform.js';
import type { PlacedLight } from '../src/placement.js';
import { lightsInView } from '../src/placement.js';

// Arcs verbatim from colregs' lights.json, as in placement.test.ts.
const ARCS = {
  masthead: { from_deg: 247.5, to_deg: 112.5 },
  starboard: { from_deg: 0.0, to_deg: 112.5 },
  port: { from_deg: 247.5, to_deg: 360.0 },
  stern: { from_deg: 112.5, to_deg: 247.5 },
  allRound: { from_deg: 0.0, to_deg: 360.0 },
} as const;

const light = (key: keyof typeof ARCS, color: string, fx: number, py: number, z: number): PlacedLight => ({
  key,
  lightId: `light:${key}`,
  color,
  character: 'steady',
  arc: { ...ARCS[key] },
  fx,
  py,
  z,
  sourceEntry: 'test',
});

const LIGHTS: PlacedLight[] = [
  light('masthead', 'white', 0.2, 0, 1.2),
  light('starboard', 'green', 0.1, 0.2, 0.5),
  light('port', 'red', 0.1, -0.2, 0.5),
  light('stern', 'white', -0.95, 0, 0.4),
  light('allRound', 'white', 0, 0, 1.4),
];

// Where each type is lit, written out as sectors rather than derived from
// the arc, so a broken cull cannot agree with itself.
const LIT: Record<keyof typeof ARCS, (t: number) => boolean> = {
  masthead: (t) => t <= 112.5 || t >= 247.5,
  starboard: (t) => t <= 112.5,
  port: (t) => t === 0 || t >= 247.5,
  stern: (t) => t >= 112.5 && t <= 247.5,
  allRound: () => true,
};

const SEATS: [number, number, number][] = LIGHTS.map((_, i) => [i, i, i]);
const BEARINGS = Array.from({ length: 360 }, (_, t) => t);

const seen3d = (theta: number): string[] =>
  seatsSeenFrom(LIGHTS, SEATS, theta).map((s) => s.light.key);

// The SVG scene draws one four-circle Glow per light; count its solid cores
// (the circle with no opacity of its own) to read how many lights it drew.
const seen2d = (theta: number): number => {
  const html = renderToStaticMarkup(
    <BearingScene hull={selectHull({})} placed={LIGHTS} theta={theta} onTheta={() => {}} hullHint={0} />,
  );
  return (html.match(/<circle(?![^>]*opacity)[^>]*>/g) ?? []).length;
};

describe('3D bearing view: a light shows only inside its arc', () => {
  for (const key of Object.keys(ARCS) as (keyof typeof ARCS)[]) {
    it(`${key}: lit exactly over its sector, at every whole degree`, () => {
      for (const t of BEARINGS) expect(seen3d(t).includes(key), `θ=${t}`).toBe(LIT[key](t));
    });
  }

  it('the sidelight cutoff: green at 112, gone at 113; stern light the other way', () => {
    expect(seen3d(112)).toContain('starboard');
    expect(seen3d(112)).not.toContain('stern');
    expect(seen3d(113)).not.toContain('starboard');
    expect(seen3d(113)).toContain('stern');
  });

  it('keeps each light with its own seat after culling', () => {
    for (const s of seatsSeenFrom(LIGHTS, SEATS, 180)) {
      expect(s.position).toBe(SEATS[LIGHTS.indexOf(s.light)]);
    }
  });

  it('culls lights with no seats yet (the mesh not profiled) the same way', () => {
    expect(seatsSeenFrom(LIGHTS, null, 180).map((s) => s.light.key)).toEqual(['stern', 'allRound']);
  });
});

describe('the SVG and 3D bearing views agree on every light', () => {
  it('draws the same lights from every whole degree', () => {
    for (const t of BEARINGS) {
      const keys = lightsInView(LIGHTS, t).map((l) => l.key);
      expect(seen3d(t), `θ=${t}`).toEqual(keys);
      expect(seen2d(t), `θ=${t}`).toBe(keys.length);
    }
  });
});
