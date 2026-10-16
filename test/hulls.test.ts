// The roster is a contract with light placement: every hull must give
// placeLights a bow, a stern, two masts and a side-light station that sit
// inside the drawn hull, and selectHull must route every fact that names a
// vessel kind to the drawing for it.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { evaluateDisplay, type FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import { allHulls, PZ, selectHull } from '../src/hulls.js';
import { placeLights } from '../src/placement.js';
import { hullFacts } from '../playground/hullFacts.js';

const hulls = Object.entries(allHulls);

describe('hull roster', () => {
  it('has the agreed twenty-six hulls with distinct ids', () => {
    expect(hulls).toHaveLength(26);
    expect(new Set(hulls.map(([, h]) => h.spec.id)).size).toBe(26);
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
    expect(Math.max(...pys)).toBeCloseTo(hull.spec.beam, 1);
    expect(Math.min(...pys)).toBeCloseTo(-hull.spec.beam, 1);
  });

  // Rule 23(a)(ii): a second masthead light is abaft of and higher than the
  // forward one; every hull a 50 m+ vessel can select must draw it that way.
  it.each([
    'containerShip',
    'tanker',
    'bulker',
    'cruiseShip',
    'ferry',
    'warship',
    'dredger',
    'squareRigger',
    'trawler',
    'tug',
    'pusher',
    'mineClearance',
    'fishingGear',
    'aground',
    'restrictedAbility',
  ] as const)('%s carries the after masthead higher than the forward one', (name) => {
    const s = allHulls[name].spec;
    expect(s.aftMastX).toBeLessThan(s.mastX);
    expect(s.aftMastTopZ).toBeGreaterThan(s.mastTopZ);
  });

  // Annex I 3(a): with two masthead lights, the forward one sits within a
  // quarter of the length from the stem and the two are at least half a
  // length apart. The warship and the mine-clearance vessel are left out:
  // Rule 1(e) exempts vessels of special construction, and a real one
  // carries its foremast on the bridge.
  it.each([
    'containerShip',
    'tanker',
    'bulker',
    'cruiseShip',
    'ferry',
    'dredger',
    'aground',
    'restrictedAbility',
  ] as const)('%s spaces its masthead lights as Annex I 3(a) asks', (name) => {
    const s = allHulls[name].spec;
    expect(1 - s.mastX).toBeLessThanOrEqual(0.5);
    expect(s.mastX - s.aftMastX).toBeGreaterThanOrEqual(1.0);
  });
});

describe('selectHull', () => {
  const cases: [string, FactRecord, keyof typeof allHulls][] = [
    ['no facts', {}, 'powerSmall'],
    ['trawling', { 'fact:activity': 'activity:trawling' }, 'trawler'],
    ['fishing other than trawling', { 'fact:activity': 'activity:fishing' }, 'seiner'],
    ['towing', { 'fact:activity': 'activity:towing' }, 'tug'],
    ['pushing', { 'fact:activity': 'activity:pushing' }, 'pusher'],
    [
      'pushing as a composite unit',
      { 'fact:activity': 'activity:pushing', 'fact:composite_unit': true },
      'pusher',
    ],
    [
      'towing with a tow over 200 m',
      { 'fact:activity': 'activity:towing', 'fact:tow_length_m': 250 },
      'tug',
    ],
    ['being towed', { 'fact:activity': 'activity:being_towed' }, 'barge'],
    [
      'a partly submerged tow',
      { 'fact:activity': 'activity:being_towed', 'fact:partly_submerged': true } as FactRecord,
      'partlySubmerged',
    ],
    [
      'a partly submerged tow, by the older key',
      { 'fact:activity': 'activity:being_towed', 'fact:inconspicuous_partly_submerged_tow': true },
      'partlySubmerged',
    ],
    [
      'being towed, not partly submerged',
      { 'fact:activity': 'activity:being_towed', 'fact:inconspicuous_partly_submerged_tow': false },
      'barge',
    ],
    ['pilot', { 'fact:activity': 'activity:pilot' }, 'pilotBoat'],
    ['constrained by draught', { 'fact:activity': 'activity:cbd' }, 'tanker'],
    ['mineclearance', { 'fact:activity': 'activity:mine' }, 'mineClearance'],
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
    [
      'trawling with gear out',
      { 'fact:activity': 'activity:trawling', 'fact:gear_extent_m': 200 },
      'fishingGear',
    ],
    [
      'fishing with gear out',
      { 'fact:activity': 'activity:fishing', 'fact:gear_extent_m': 40 },
      'fishingGear',
    ],
    [
      'trawling, gear extent 0',
      { 'fact:activity': 'activity:trawling', 'fact:gear_extent_m': 0 },
      'trawler',
    ],
    [
      'fishing, gear extent 0',
      { 'fact:activity': 'activity:fishing', 'fact:gear_extent_m': 0 },
      'seiner',
    ],
    [
      'gear extent without fishing',
      { 'fact:activity': 'activity:towing', 'fact:gear_extent_m': 200 },
      'tug',
    ],
    ['aground', { 'fact:position': 'position:aground' }, 'aground'],
    [
      'aground outranks activity',
      {
        'fact:position': 'position:aground',
        'fact:activity': 'activity:trawling',
        'fact:gear_extent_m': 200,
      },
      'aground',
    ],
    [
      'aground outranks length',
      { 'fact:position': 'position:aground', 'fact:length_m': 200 },
      'aground',
    ],
    [
      'at anchor is not aground',
      { 'fact:position': 'position:anchored', 'fact:activity': 'activity:trawling' },
      'trawler',
    ],
    ['diving', { 'fact:activity': 'activity:diving' }, 'diveSupport'],
    ['diving at 60 m', { 'fact:activity': 'activity:diving', 'fact:length_m': 60 }, 'diveSupport'],
    [
      'restricted in ability to manoeuvre',
      { 'fact:activity': 'activity:ram' },
      'restrictedAbility',
    ],
    [
      'underwater operations stay with the dredger',
      { 'fact:activity': 'activity:ram_underwater', 'fact:length_m': 60 },
      'dredger',
    ],
    ['wing-in-ground craft', { 'fact:wig': true }, 'wingInGround'],
    [
      'wing-in-ground craft near the surface',
      { 'fact:wig': true, 'fact:wig_near_surface': true, 'fact:length_m': 15 },
      'wingInGround',
    ],
    ['wing-in-ground outranks length', { 'fact:wig': true, 'fact:length_m': 60 }, 'wingInGround'],
    [
      'fact:wig false is a plain power vessel',
      { 'fact:wig': false, 'fact:length_m': 15 },
      'powerSmall',
    ],
    [
      'aground outranks wing-in-ground',
      { 'fact:position': 'position:aground', 'fact:wig': true },
      'aground',
    ],
    [
      'activity outranks length',
      { 'fact:activity': 'activity:pilot', 'fact:length_m': 200 },
      'pilotBoat',
    ],
  ];
  it.each(cases)('%s', (_label, facts, expected) => {
    expect(selectHull(facts)).toBe(allHulls[expected]);
  });
});

describe('gallery lights in the profile frame', () => {
  // The station check above keeps the hand anchors under 1.15 so a light
  // and its glow clear the top of the profile viewBox. Annex I can lift a
  // masthead light above its anchor; past the top edge the viewer is shown
  // one light fewer than the vessel carries. Checked with the gallery's facts.
  const json = (id: string) =>
    JSON.parse(readFileSync(createRequire(import.meta.url).resolve(id), 'utf8')) as unknown;
  const lightsData = json('colregs/data/lights.json') as LightsData;
  const geometry = json('colregs/data/geometry.json') as GeometryData;
  it.each(hulls)('%s puts every gallery light inside the profile', (name, hull) => {
    const facts = hullFacts[name as keyof typeof hullFacts];
    const display = evaluateDisplay(facts).displays[0];
    const placed = placeLights(display.lights, hull.spec, facts, lightsData, geometry);
    for (const l of placed) expect(PZ(l.z), l.key).toBeGreaterThanOrEqual(0);
  });
});
