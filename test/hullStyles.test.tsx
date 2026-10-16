// Every style paints every hull, and painting is all it does: the base
// drawing is inside the styled picture unchanged, the lights land where they
// land unstyled, and every paint the markup refers to is defined in it.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateDisplay } from 'colregs-engine';
import type { FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { BearingScene } from '../src/BearingView.js';
import { PlanView } from '../src/PlanView.js';
import { ProfileView } from '../src/ProfileView.js';
import { allHulls } from '../src/hulls.js';
import { hasSails, hullStyleIds, hullStyles } from '../src/hullStyles.js';
import { placeLights } from '../src/placement.js';
import { LIGHT_COLORS } from '../src/svg.js';

const lightsData = lightsJson as unknown as LightsData;
const geometryData = geometryJson as unknown as GeometryData;

const facts: FactRecord = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:making_way': true,
  'fact:length_m': 30,
};
const lights = evaluateDisplay(facts).displays[0]!.lights;

const pairs = Object.entries(allHulls).flatMap(([name, hull]) =>
  hullStyleIds.map((id) => [name, id, hull, hullStyles[id]] as const),
);

/** Light glows: the circles filled with a light colour, in render order. */
function glows(markup: string): string[] {
  const fills = new Set(Object.values(LIGHT_COLORS));
  return [...markup.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)" fill="([^"]+)"/g)]
    .filter((m) => fills.has(m[4]!))
    .map((m) => m.slice(1).join(' '));
}

/** Every url(#id) the markup points at has its id defined in the markup. */
function danglingRefs(markup: string): string[] {
  const ids = new Set([...markup.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  return [...markup.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!).filter((id) => !ids.has(id));
}

describe('hull style registry', () => {
  it('ships at least three styles with distinct ids matching their keys', () => {
    expect(hullStyleIds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(hullStyleIds).size).toBe(hullStyleIds.length);
    for (const id of hullStyleIds) expect(hullStyles[id].id).toBe(id);
    expect(new Set(hullStyleIds.map((id) => hullStyles[id].name)).size).toBe(hullStyleIds.length);
  });

  it('draws sails on every sailing hull', () => {
    for (const k of ['sailSmall', 'sailLarge', 'squareRigger'] as const)
      expect(hasSails(allHulls[k])).toBe(true);
  });
});

describe.each(pairs)('%s in %s', (_name, _id, hull, style) => {
  const placed = placeLights(lights, hull.spec, facts, lightsData, geometryData);

  it('profile: paints the base drawing unchanged and lights it where unstyled', () => {
    const base = renderToStaticMarkup(<ProfileView hull={hull} placed={placed} facts={facts} />);
    const styled = renderToStaticMarkup(
      <ProfileView hull={hull} placed={placed} facts={facts} style={style} />,
    );
    expect(styled).toContain(renderToStaticMarkup(<hull.Profile />));
    expect(glows(styled)).toEqual(glows(base));
    expect(glows(styled).length).toBeGreaterThan(0);
    expect(danglingRefs(styled)).toEqual([]);
  });

  it('plan: same outline and lights, paints defined', () => {
    const props = { hull, placed, theta: 45, onTheta: () => {} };
    const base = renderToStaticMarkup(<PlanView {...props} />);
    const styled = renderToStaticMarkup(<PlanView {...props} style={style} />);
    const outline = (m: string) => m.match(/<path d="([^"]+)" fill="var\(--hull-fill\)"/)?.[1];
    expect(outline(styled)).toBe(outline(base));
    expect(glows(styled)).toEqual(glows(base));
    expect(danglingRefs(styled)).toEqual([]);
  });

  it('bearing: same lights, paints defined', () => {
    const props = { hull, placed, theta: 60, onTheta: () => {}, hullHint: 1, seascape: true };
    const base = renderToStaticMarkup(<BearingScene {...props} />);
    const styled = renderToStaticMarkup(<BearingScene {...props} style={style} />);
    expect(glows(styled)).toEqual(glows(base));
    expect(styled).toContain('var(--hint-fill)');
    expect(danglingRefs(styled)).toEqual([]);
  });
});

describe('no style', () => {
  it('leaves every view as it was: no defs, no scoped paint', () => {
    const hull = allHulls.powerSmall;
    const placed = placeLights(lights, hull.spec, facts, lightsData, geometryData);
    const profile = renderToStaticMarkup(<ProfileView hull={hull} placed={placed} facts={facts} />);
    const plan = renderToStaticMarkup(
      <PlanView hull={hull} placed={placed} theta={45} onTheta={() => {}} />,
    );
    for (const m of [profile, plan]) {
      expect(m).not.toContain('<defs');
      expect(m).not.toContain('style=');
    }
    const bearing = renderToStaticMarkup(
      <BearingScene hull={hull} placed={placed} theta={60} onTheta={() => {}} hullHint={1} />,
    );
    expect(bearing).toContain('fill="#3a4a60"');
  });
});
