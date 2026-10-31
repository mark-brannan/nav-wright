import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateSignals, type Situation } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import situationJson from 'colregs/fixtures/situation-fixtures.json' with { type: 'json' };
import { SceneView } from '../src/SceneView.js';
import { selectHull } from '../src/hulls.js';
import { lightsInView, placeLights } from '../src/placement.js';
import { bearingTheta } from '../src/sceneGeometry.js';
import { situationPair, situationToScene } from '../src/sceneSituation.js';

const cases = (situationJson as unknown as { cases: { name: string; situation: Situation }[] })
  .cases;
const fixture = (prefix: string): Situation =>
  structuredClone(cases.find((c) => c.name.startsWith(prefix))!.situation);
const angle = (a: number, b: number, digits = 6) =>
  expect(Math.abs(((a - b + 540) % 360) - 180)).toBeCloseTo(0, digits);

const facts = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:making_way': true,
  'fact:length_m': 40,
} as const;
const hull = selectHull(facts);
const placed = placeLights(
  evaluateSignals(facts).displays[0]!.lights,
  hull.spec,
  facts,
  lightsJson as unknown as LightsData,
  geometryJson as unknown as GeometryData,
);
const vessels = { own: { hull, placed }, target: { hull, placed } };
const colours = (theta: number) => new Set(lightsInView(placed, theta).map((l) => l.color));

describe('situationPair', () => {
  it('reads the crossing fixture: target 040 relative at 3 nm', () => {
    const p = situationPair(fixture('crossing:'));
    expect(p).toEqual({ ownHeading: 0, targetHeading: 300, relativeBearing: 40, rangeM: 5556 });
  });

  it('agrees with the positions when the stated geometry is absent', () => {
    const s = fixture('crossing:');
    delete s.self.geo;
    delete s.other!.geo;
    delete s.pair!.geo!['geo:range_m'];
    const p = situationPair(s);
    angle(p.relativeBearing, 40, 1);
    expect(Math.abs(p.rangeM - 5556)).toBeLessThan(30);
  });

  it("turns other's bearing of self round when self states none", () => {
    const s = fixture('crossing:');
    delete s.self.geo;
    angle(situationPair(s).relativeBearing, 40);
  });

  // The orientation check against colregs' own data: θ derived from self's
  // bearing of other must be the bearing other states of self, in every
  // fixture that states both.
  it("derives θ equal to other's stated bearing of self in every fixture", () => {
    let n = 0;
    for (const c of cases) {
      const s = c.situation;
      const selfRel = s.self.geo?.['geo:rel_bearing_deg'];
      const otherRel = s.other?.geo?.['geo:rel_bearing_deg'];
      if (selfRel === undefined || otherRel === undefined) continue;
      if (s.self.kin?.['kin:heading_deg'] === undefined) continue;
      angle(bearingTheta(situationPair(s)), otherRel, 6);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('throws when a heading is missing', () => {
    const s = fixture('crossing:');
    delete s.other!.kin!['kin:heading_deg'];
    expect(() => situationPair(s)).toThrow(/kin:heading_deg/);
  });

  it('throws when neither stated geometry nor positions give a range', () => {
    const s = fixture('crossing:');
    delete s.pair;
    delete s.other!.kin!['kin:position'];
    expect(() => situationPair(s)).toThrow(/range_m/);
  });
});

describe('situationToScene', () => {
  it('crossing: own ship, give-way, sees the target red side, not green', () => {
    const s = fixture('crossing:');
    const props = situationToScene(s, vessels);
    expect(props.own.heading).toBe(0);
    expect(props.target.heading).toBe(300);
    expect(props.own.speedMps).toBeCloseTo((12 * 1852) / 3600, 9);
    expect(props.cpa).toEqual({ cpaM: 1, tcpaS: 1023 });
    expect(props.env).toBeUndefined();
    const theta = bearingTheta(situationPair(s));
    expect(theta).toBeCloseTo(280, 9);
    expect(colours(theta).has('red')).toBe(true);
    expect(colours(theta).has('green')).toBe(false);
  });

  it('head-on in a narrow channel: the channel backdrop, and the aspect the fixture states', () => {
    const s = fixture('narrow channel: head-on');
    const props = situationToScene(s, vessels);
    expect(props.env).toEqual({ narrowChannel: true, trafficLane: false });
    // own ship sits 3.6 on the target's starboard bow: her green, not her red
    const theta = bearingTheta(situationPair(s));
    angle(theta, 3.6);
    expect(colours(theta).has('green')).toBe(true);
    expect(colours(theta).has('red')).toBe(false);
  });

  it('head-on dead ahead: both sidelights', () => {
    const s = fixture('narrow channel: head-on');
    s.self.kin!['kin:heading_deg'] = 0;
    s.self.geo!['geo:rel_bearing_deg'] = 0;
    s.other!.kin!['kin:heading_deg'] = 180;
    const theta = bearingTheta(situationPair(s));
    angle(theta, 0);
    expect(colours(theta).has('red') && colours(theta).has('green')).toBe(true);
  });

  it('overtaking: own ship astern of the target sees her sternlight only', () => {
    const s = fixture('13(b): self is the vessel being overtaken');
    // flip the roles so own ship is the overtaking vessel
    const flipped: Situation = { self: s.other!, other: s.self, pair: s.pair! };
    const theta = bearingTheta(situationPair(flipped));
    angle(theta, 200);
    expect(theta).toBeGreaterThan(112.5);
    expect(theta).toBeLessThan(247.5);
    const seen = colours(theta);
    expect(seen.has('red') || seen.has('green')).toBe(false);
    expect(seen.has('white')).toBe(true);
  });

  it('leaves out a CPA it cannot draw and speeds the record omits', () => {
    const s = fixture('crossing:');
    delete s.pair!.geo!['geo:tcpa_s'];
    delete s.other!.kin!['kin:sog_kn'];
    const props = situationToScene(s, vessels);
    expect(props.cpa).toBeUndefined();
    expect('speedMps' in props.target).toBe(false);
  });

  it('renders through SceneView with each hull turned to her heading', () => {
    const html = renderToStaticMarkup(
      <SceneView {...situationToScene(fixture('crossing:'), vessels)} />,
    );
    expect(html).toContain('rotate(0)');
    expect(html).toContain('rotate(300)');
    expect(html).toContain('data-cpa');
  });
});
