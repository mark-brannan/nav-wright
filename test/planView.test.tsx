// The plan view as a chart inset: the rose, the labelled 112.5° and 247.5°
// lines, the named sectors and the keyboard-driven sightline. The engine
// supplies the display; nothing here is hand-placed.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateSignals } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { LightsData } from 'colregs-engine/schema';
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { PlanView, planRings, planThetaForKey } from '../src/PlanView.js';
import { selectHull } from '../src/hulls.js';
import { placeLights } from '../src/placement.js';

const lightsData = lightsJson as unknown as LightsData;
const facts = {
  'fact:propulsion': 'propulsion:power',
  'fact:position': 'position:underway',
  'fact:making_way': true,
  'fact:activity': 'activity:none',
  'fact:length_m': 30,
} as FactRecord;

const scene = () => {
  const hull = selectHull(facts);
  const display = evaluateSignals(facts).displays[0]!;
  return { hull, placed: placeLights(display.lights, hull.spec, facts, lightsData) };
};

describe('PlanView chart inset', () => {
  it('names every arc sector from lights.json', () => {
    const rings = planRings(scene().placed);
    const names = rings.map((r) => r.names);
    expect(names).toContain('white masthead light');
    expect(names.some((n) => n.includes('sidelight'))).toBe(true);
    expect(names.some((n) => n.includes('sternlight'))).toBe(true);
  });

  it('draws the rose, the labelled cutoff lines and the sightline at θ', () => {
    const { hull, placed } = scene();
    const html = renderToStaticMarkup(
      <PlanView hull={hull} placed={placed} theta={45} onTheta={() => {}} />,
    );
    for (const n of ['000', '090', '180', '270', '330']) expect(html).toContain(`>${n}<`);
    expect(html).toContain('>112.5°<');
    expect(html).toContain('>247.5°<');
    expect(html.match(/22\.5° abaft the beam/g)).toHaveLength(2);
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuenow="45"');
    expect(html).toContain('θ 045°');
    expect(html).toContain('aria-label="white masthead light, 247.5° to 112.5°"');
    expect(html).toMatchSnapshot();
  });

  it('moves θ with the arrow keys, wrapping through 0', () => {
    expect(planThetaForKey(0, 'ArrowRight')).toBe(1);
    expect(planThetaForKey(0, 'ArrowLeft')).toBe(359);
    expect(planThetaForKey(355, 'ArrowUp', true)).toBe(5);
    expect(planThetaForKey(5, 'ArrowDown', true)).toBe(355);
    expect(planThetaForKey(90, 'Home')).toBe(0);
    expect(planThetaForKey(90, 'Enter')).toBeNull();
  });
});
