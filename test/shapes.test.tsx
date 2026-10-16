// Day shapes: placement from shapes.json and geometry.json (Annex I 6, Rule
// 20(d)), and the day-mode views. The engine supplies the displays; nothing
// here is hand-placed.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateDisplay } from 'colregs-engine';
import type { Display, DisplayShape, FactRecord } from 'colregs-engine';
import type { GeometryData } from 'colregs-engine/schema';
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import shapesJson from 'colregs/data/shapes.json' with { type: 'json' };
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json' with { type: 'json' };
import { PlanView } from '../src/PlanView.js';
import { ProfileView } from '../src/ProfileView.js';
import { ShapeMark } from '../src/shapeMarks.js';
import { allHulls, selectHull } from '../src/hulls.js';
import { hullStyles } from '../src/hullStyles.js';
import { placeLights } from '../src/placement.js';
import { placeShapes } from '../src/shapes.js';
import type { PlacedShape, ShapesData } from '../src/shapes.js';
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import type { LightsData } from 'colregs-engine/schema';

const geometry = geometryJson as unknown as GeometryData;
const shapesData = shapesJson as unknown as ShapesData;
const lightsData = lightsJson as unknown as LightsData;
const SPACING = geometry.shapes.vertical_spacing_min_m!;

const day = (f: Record<string, unknown>) => ({ ...f, 'fact:time': 'time:day' }) as FactRecord;
const displayOf = (facts: FactRecord): Display => evaluateDisplay(facts).displays[0]!;
const run = (facts: FactRecord) => {
  const hull = selectHull(facts);
  return {
    hull,
    shapes: placeShapes(displayOf(facts).shapes, hull.spec, facts, shapesData, geometry),
  };
};
/** metres above the deck of a shape's top and bottom edge */
const top = (s: PlacedShape) => s.heightAboveDeckM + s.heightM / 2;
const bottom = (s: PlacedShape) => s.heightAboveDeckM - s.heightM / 2;
const byEntry = (ss: PlacedShape[], prefix: string) =>
  ss.filter((s) => s.sourceEntry.startsWith(prefix));
const topToBottom = (ss: PlacedShape[]) => [...ss].sort((a, b) => b.z - a.z);

const power = (len: number, over: Record<string, unknown> = {}) => ({
  'fact:propulsion': 'propulsion:power',
  'fact:position': 'position:underway',
  'fact:length_m': len,
  ...over,
});

describe('shape sizes come from shapes.json', () => {
  it('ball 0.6 m, cone base 0.6 m high 0.6 m, cylinder 0.6 x 1.2, diamond 0.6 x 1.2', () => {
    const f = day(power(40, { 'fact:activity': 'activity:ram', 'fact:making_way': true }));
    const { shapes } = run(f);
    const dims = (id: string) => shapes.find((s) => s.shapeId === id);
    expect([dims('shape:ball')!.widthM, dims('shape:ball')!.heightM]).toEqual([0.6, 0.6]);
    expect([dims('shape:diamond')!.widthM, dims('shape:diamond')!.heightM]).toEqual([0.6, 1.2]);
    const cone = shapesData.shapes['shape:cone_up']!;
    expect(cone.min_base_diameter_m).toBe(0.6);
    const cyl = shapesData.shapes['shape:cylinder']!;
    expect(cyl.svg).toContain('viewBox="0 0 0.6 1.2"');
  });
});

describe('placement per rule', () => {
  it('24(a)(v): a tow over 200 m shows one diamond, best seen on the mast', () => {
    const { hull, shapes } = run(
      day(power(40, { 'fact:activity': 'activity:towing', 'fact:tow_length_m': 300 })),
    );
    expect(shapes.map((s) => s.shapeId)).toEqual(['shape:diamond']);
    expect(shapes[0]!.fx).toBe(hull.spec.mastX);
    expect(shapes[0]!.py).toBe(0);
  });

  it('25(e): motorsailing shows one cone, apex down', () => {
    const { shapes } = run(
      day({
        'fact:propulsion': 'propulsion:power',
        'fact:activity': 'activity:none',
        'fact:position': 'position:underway',
        'fact:length_m': 11.6,
        'fact:motorsailing': true,
      }),
    );
    expect(shapes.map((s) => s.shapeId)).toEqual(['shape:cone_down']);
  });

  it('26: fishing cones meet at their apexes, upper apex down, lower apex up', () => {
    const { shapes } = run(
      day(power(30, { 'fact:activity': 'activity:trawling', 'fact:making_way': true })),
    );
    const s = topToBottom(shapes);
    expect(s.map((x) => x.shapeId)).toEqual(['shape:cone_down', 'shape:cone_up']);
    expect(bottom(s[0]!)).toBeCloseTo(top(s[1]!), 9);
    expect(s[0]!.fx).toBe(s[1]!.fx);
  });

  it('26(c)(ii): gear beyond 150 m adds a cone apex up, offset from the stack', () => {
    const { shapes } = run(
      day(
        power(12, {
          'fact:activity': 'activity:fishing',
          'fact:making_way': false,
          'fact:gear_extent_m': 200,
        }),
      ),
    );
    const gear = byEntry(shapes, 'rule:26c_ii')[0]!;
    expect(gear.shapeId).toBe('shape:cone_up');
    const min = geometry.direction_indicating!.find((d) => d.horizontal_from_identity_lights_m)!
      .horizontal_from_identity_lights_m!.min!;
    expect(Math.abs(gear.py) * gear.halfLengthM).toBeGreaterThanOrEqual(min - 1e-9);
  });

  it('27(b)(ii): ball, diamond, ball top to bottom, one vertical line, 1.5 m apart', () => {
    const { shapes } = run(
      day(
        power(60, {
          'fact:activity': 'activity:diving',
          'fact:making_way': true,
          'fact:obstruction_exists': false,
          'fact:full_display_impracticable': false,
        }),
      ),
    );
    const s = topToBottom(byEntry(shapes, 'rule:27b'));
    expect(s.map((x) => x.shapeId)).toEqual(['shape:ball', 'shape:diamond', 'shape:ball']);
    expect(new Set(s.map((x) => x.fx)).size).toBe(1);
    expect(new Set(s.map((x) => x.py))).toEqual(new Set([0]));
    for (let i = 0; i + 1 < s.length; i++) {
      expect(bottom(s[i]!) - top(s[i + 1]!)).toBeGreaterThanOrEqual(SPACING - 1e-9);
    }
  });

  it('27(d): side shapes at least 2 m abeam, upper no higher than the lowest 27(b) shape', () => {
    const facts = day(
      power(45, {
        'fact:activity': 'activity:ram_underwater',
        'fact:making_way': true,
        'fact:obstruction_exists': true,
        'fact:obstruction_side': 'obstruction_side:port',
      }),
    );
    const { shapes } = run(facts);
    const stack = topToBottom(byEntry(shapes, 'rule:27b'));
    const sides = byEntry(shapes, 'rule:27d');
    expect(sides.filter((x) => x.shapeId === 'shape:ball')).toHaveLength(2);
    expect(sides.filter((x) => x.shapeId === 'shape:diamond')).toHaveLength(2);
    for (const x of sides) expect(Math.abs(x.py) * x.halfLengthM).toBeGreaterThanOrEqual(2);
    // balls where the obstruction is (port), diamonds where it is safe to pass
    for (const x of sides) {
      expect(Math.sign(x.py)).toBe(x.shapeId === 'shape:ball' ? -1 : 1);
    }
    const lowest = stack[stack.length - 1]!;
    for (const side of [-1, 1]) {
      const col = topToBottom(sides.filter((x) => Math.sign(x.py) === side));
      expect(top(col[0]!)).toBeLessThanOrEqual(top(lowest) + 1e-9);
      expect(bottom(col[0]!) - top(col[1]!)).toBeGreaterThanOrEqual(SPACING - 1e-9);
    }
  });

  it('28: constrained by draft underway shows a cylinder, 0.6 x 1.2 m', () => {
    // a 'may' component: the engine returns it as an optional addition
    const facts = day(power(200, { 'fact:activity': 'activity:cbd' }));
    const hull = selectHull(facts);
    const adds = evaluateDisplay(facts).optionalAdditions as { shapes: DisplayShape[] }[];
    const add = adds.find((a) => a.shapes.length > 0)!;
    const shapes = placeShapes(add.shapes, hull.spec, facts, shapesData, geometry);
    expect(shapes.map((s) => s.shapeId)).toEqual(['shape:cylinder']);
    expect([shapes[0]!.widthM, shapes[0]!.heightM]).toEqual([0.6, 1.2]);
  });

  it('30(a)(i): an anchored vessel shows one ball in the fore part', () => {
    const { hull, shapes } = run(
      day(power(200, { 'fact:activity': 'activity:cbd', 'fact:position': 'position:anchored' })),
    );
    expect(shapes.map((s) => s.shapeId)).toEqual(['shape:ball']);
    expect(shapes[0]!.fx).toBeGreaterThan(hull.spec.mastX);
  });

  it('30(d)(ii): aground shows three balls in a vertical line, 1.5 m apart', () => {
    const { shapes } = run(
      day(power(30, { 'fact:activity': 'activity:fishing', 'fact:position': 'position:aground' })),
    );
    const s = topToBottom(shapes);
    expect(s.map((x) => x.shapeId)).toEqual(['shape:ball', 'shape:ball', 'shape:ball']);
    expect(new Set(s.map((x) => x.fx)).size).toBe(1);
    for (let i = 0; i + 1 < s.length; i++) {
      expect(bottom(s[i]!) - top(s[i + 1]!)).toBeGreaterThanOrEqual(SPACING - 1e-9);
    }
  });
});

describe('Annex I 6 small-vessel relief', () => {
  const ball = (len: number) =>
    run(
      day(power(len, { 'fact:activity': 'activity:fishing', 'fact:position': 'position:aground' })),
    ).shapes;

  it('under 20 m the shapes and the spacing shrink together', () => {
    const small = topToBottom(ball(15));
    const big = topToBottom(ball(30));
    expect(small[0]!.widthM).toBeLessThan(big[0]!.widthM);
    const gap = (s: PlacedShape[]) => bottom(s[0]!) - top(s[1]!);
    expect(gap(small) / small[0]!.heightM).toBeCloseTo(SPACING / big[0]!.heightM, 9);
  });

  it('at 20 m and over the full size and 1.5 m hold', () => {
    const s = topToBottom(ball(20));
    expect(s[0]!.widthM).toBe(0.6);
    expect(bottom(s[0]!) - top(s[1]!)).toBeCloseTo(SPACING, 9);
  });
});

describe('every day fixture, every shape', () => {
  const cases = (
    fixturesJson as { cases: { name: string; facts: Record<string, unknown> }[] }
  ).cases.filter((c) => c.facts['fact:time'] === 'time:day');

  it('every Display.shapes entry the colregs fixtures yield becomes a PlacedShape', () => {
    let checked = 0;
    for (const c of cases) {
      let displays: Display[];
      try {
        displays = evaluateDisplay(c.facts as FactRecord).displays;
      } catch {
        continue; // a fixture newer than the installed engine's fact keys
      }
      const hull = selectHull(c.facts as FactRecord);
      for (const d of displays) {
        const placed = placeShapes(
          d.shapes,
          hull.spec,
          c.facts as FactRecord,
          shapesData,
          geometry,
        );
        const want = d.shapes.reduce((n, s) => n + (s.spec.count ?? 1), 0);
        expect(placed, c.name).toHaveLength(want);
        for (const p of placed) expect(Number.isFinite(p.z + p.fx + p.py), c.name).toBe(true);
        checked += want;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('every shape id in shapes.json renders without throwing', () => {
    for (const id of Object.keys(shapesData.shapes)) {
      const def = shapesData.shapes[id]!;
      const p = placeShapes(
        [{ spec: { shape: id }, source_entry: 'test', modality: 'modality:shall' } as never],
        allHulls.powerSmall.spec,
        day(power(40)),
        shapesData,
        geometry,
      );
      expect(p, id).toHaveLength(1);
      const html = renderToStaticMarkup(
        <svg>
          <ShapeMark shape={p[0]!} x={10} y={10} pxPerM={10} />
        </svg>,
      );
      expect(html, id).toContain(`data-shape="${id}"`);
      expect(html, id).toContain(def.svg.match(/<(path|circle|rect)/)![0]);
    }
  });

  it('shapes.json carries no basket, so none is drawn', () => {
    expect(Object.keys(shapesData.shapes).some((k) => k.includes('basket'))).toBe(false);
  });
});

describe('day views', () => {
  const facts = day(power(45, { 'fact:activity': 'activity:ram', 'fact:making_way': true }));
  const hull = selectHull(facts);
  const d = displayOf(facts);
  const placed = placeLights(d.lights, hull.spec, facts, lightsData, geometry);
  const shapes = placeShapes(d.shapes, hull.spec, facts, shapesData, geometry);
  const profile = (extra: object = {}) =>
    renderToStaticMarkup(<ProfileView hull={hull} placed={placed} facts={facts} {...extra} />);
  const plan = (extra: object = {}) =>
    renderToStaticMarkup(
      <PlanView hull={hull} placed={placed} theta={0} onTheta={() => {}} {...extra} />,
    );

  it('the default is night: no day ground, shapes ignored', () => {
    const night = profile();
    expect(night).toContain('fill="var(--sea-night)"');
    expect(night).not.toContain('sky-day');
    expect(profile({ shapes })).toBe(night);
    expect(profile({ time: 'night', shapes })).toBe(night);
    expect(plan({ shapes })).toBe(plan());
  });

  it('day profile draws every shape on the mast and no lights', () => {
    const html = profile({ time: 'day', shapes });
    expect(html).toContain('sky-day');
    expect((html.match(/class="day-shape"/g) ?? []).length).toBe(shapes.length);
    expect(html).not.toContain('<radialGradient');
    expect(html).toMatchSnapshot();
  });

  it('day plan marks every shape position and lists what they are', () => {
    const html = plan({ time: 'day', shapes });
    expect(html).toContain('sea-day');
    expect(html).toContain('aria-label="Day shapes"');
    expect(html).toContain('ball ×');
    expect(html).toContain('diamond ×');
    expect(html).not.toContain('opacity="0.28"'); // no light arcs by day
  });

  it('a styled hull keeps its style by day: same hull geometry, daylight palette', () => {
    for (const [id, style] of Object.entries(hullStyles)) {
      const n = profile({ style });
      const dd = profile({ style, time: 'day' });
      expect(style.day, id).toBeDefined();
      expect(dd, id).not.toBe(n);
      expect(dd, id).toContain(`hull-style-${style.id}`);
      expect(dd.match(/<path d="[^"]*"/g)!.filter((p) => !p.includes('rotate')).length, id).toBe(
        n.match(/<path d="[^"]*"/g)!.filter((p) => !p.includes('rotate')).length,
      );
    }
  });
});
