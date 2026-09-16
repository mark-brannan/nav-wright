// The roster is a contract with light placement: every hull must give
// placeLights a bow, a stern, two masts and a side-light station that sit
// inside the drawn hull, and selectHull must route every fact that names a
// vessel kind to the drawing for it.

import { describe, expect, it } from 'vitest';
import type { FactRecord } from 'colregs-engine';
import { allHulls, selectHull } from '../src/hulls.js';

const hulls = Object.entries(allHulls);

describe('hull roster', () => {
  it('has the agreed eighteen hulls with distinct ids', () => {
    expect(hulls).toHaveLength(18);
    expect(new Set(hulls.map(([, h]) => h.spec.id)).size).toBe(18);
  });

  it.each(hulls)('%s keeps its light stations inside the hull', (_name, hull) => {
    const s = hull.spec;
    expect(s.bowX).toBeGreaterThan(0.8);
    expect(s.sternX).toBeLessThan(-0.75);
    expect(s.beam).toBeGreaterThan(0);
    expect(s.beam).toBeLessThanOrEqual(0.3);
    for (const x of [s.mastX, s.aftMastX, s.sideLightX]) {
      expect(x).toBeLessThan(s.bowX);
      expect(x).toBeGreaterThan(s.sternX);
    }
    // masthead lights must clear the profile viewBox with their glow
    expect(s.mastTopZ).toBeLessThanOrEqual(1.15);
    expect(s.aftMastTopZ).toBeLessThanOrEqual(1.15);
    expect(s.sternZ).toBeGreaterThan(0);
  });

  it.each(hulls)('%s plan outline is a closed shape with the bow forward', (_name, hull) => {
    expect(hull.plan.length).toBeGreaterThanOrEqual(8);
    const fxs = hull.plan.map(([fx]) => fx);
    const pys = hull.plan.map(([, py]) => py);
    expect(Math.max(...fxs)).toBeCloseTo(1, 1);
    expect(Math.min(...fxs)).toBeLessThan(-0.85);
    expect(Math.max(...pys)).toBeCloseTo(hull.spec.beam, 0);
    expect(Math.min(...pys)).toBeCloseTo(-hull.spec.beam, 0);
  });

  // Rule 23(a)(ii): a second masthead light is abaft of and higher than the
  // forward one; every hull a 50 m+ vessel can select must draw it that way.
  it.each(['containerShip', 'tanker', 'bulker', 'cruiseShip', 'ferry', 'warship', 'dredger', 'squareRigger'] as const)(
    '%s carries the after masthead higher than the forward one',
    (name) => {
      const s = allHulls[name].spec;
      expect(s.aftMastX).toBeLessThan(s.mastX);
      expect(s.aftMastTopZ).toBeGreaterThan(s.mastTopZ);
    },
  );
});

describe('selectHull', () => {
  const cases: [string, FactRecord, keyof typeof allHulls][] = [
    ['no facts', {}, 'powerSmall'],
    ['trawling', { 'fact:activity': 'activity:trawling' }, 'trawler'],
    ['fishing other than trawling', { 'fact:activity': 'activity:fishing' }, 'seiner'],
    ['towing', { 'fact:activity': 'activity:towing' }, 'tug'],
    ['pushing', { 'fact:activity': 'activity:pushing' }, 'tug'],
    ['being towed', { 'fact:activity': 'activity:being_towed' }, 'barge'],
    ['pilot', { 'fact:activity': 'activity:pilot' }, 'pilotBoat'],
    ['constrained by draught', { 'fact:activity': 'activity:cbd' }, 'tanker'],
    ['mineclearance', { 'fact:activity': 'activity:mine' }, 'warship'],
    ['underwater operations', { 'fact:activity': 'activity:ram_underwater' }, 'dredger'],
    ['oars', { 'fact:propulsion': 'propulsion:oars' }, 'openBoat'],
    ['sail 12 m', { 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 12 }, 'sailSmall'],
    ['sail 30 m', { 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 30 }, 'sailLarge'],
    ['sail 60 m', { 'fact:propulsion': 'propulsion:sail', 'fact:length_m': 60 }, 'squareRigger'],
    ['power 5 m', { 'fact:length_m': 5 }, 'openBoat'],
    ['power 15 m', { 'fact:length_m': 15 }, 'powerSmall'],
    ['power 40 m', { 'fact:length_m': 40 }, 'powerLarge'],
    ['power 90 m', { 'fact:length_m': 90 }, 'ferry'],
    ['power 200 m', { 'fact:length_m': 200 }, 'containerShip'],
    ['power 200 m at 14 kn', { 'fact:length_m': 200, 'fact:max_speed_kn': 14 }, 'bulker'],
    ['power 200 m at 22 kn', { 'fact:length_m': 200, 'fact:max_speed_kn': 22 }, 'containerShip'],
    ['activity outranks length', { 'fact:activity': 'activity:pilot', 'fact:length_m': 200 }, 'pilotBoat'],
  ];
  it.each(cases)('%s', (_label, facts, expected) => {
    expect(selectHull(facts)).toBe(allHulls[expected]);
  });
});
