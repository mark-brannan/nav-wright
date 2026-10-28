// Tows and pushed groups (Rule 24): each vessel of the group keeps her own
// lawful display, the tow length is told against 24(a)(i)'s threshold as
// colregs states it, and a composite unit is one vessel. The engine
// supplies the displays; nothing here is hand-lit.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateSignals } from 'colregs-engine';
import type { Display, DisplayLight, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import geometryJson from 'colregs/data/geometry.json' with { type: 'json' };
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import shapesJson from 'colregs/data/shapes.json' with { type: 'json' };
import { allHulls } from '../src/hulls.js';
import type { ShapesData } from '../src/shapes.js';
import { layoutTow, towThreshold } from '../src/towGeometry.js';
import type { TowGroup, TowRecord } from '../src/towScene.js';
import { TowPlanView, TowProfileView, towGroupFromRecords, towLayout } from '../src/towScene.js';
import * as entry from '../src/index.js';

const data = {
  lights: lightsJson as unknown as LightsData,
  geometry: geometryJson as unknown as GeometryData,
  shapes: shapesJson as unknown as ShapesData,
};
const applicability = applicabilityJson as unknown as {
  entries: { id: string; lights?: DisplayLight['spec'][]; modality: DisplayLight['modality'] }[];
};
const threshold = towThreshold(applicability)!;

const underway = { 'fact:position': 'position:underway', 'fact:making_way': true } as const;
const record = (facts: Record<string, unknown>): TowRecord => {
  const f = facts as FactRecord;
  return { facts: f, display: evaluateSignals(f).displays[0]! };
};
/**
 * colregs-engine 0.1.9's fact vocabulary predates fact:tow_rigidity, so it
 * throws on a 24(f) record. Until it catches up, read the display straight
 * from the named applicability entry's lights; once the engine takes the
 * key, the engine answers and this falls through to it.
 */
const record24f = (facts: Record<string, unknown>, entryId: string): TowRecord => {
  try {
    return record(facts);
  } catch {
    const e = applicability.entries.find((x) => x.id === entryId)!;
    const display: Display = {
      entries: [e.id],
      lights: (e.lights ?? []).map((spec) => ({
        spec,
        source_entry: e.id,
        sourceEntry: e.id,
        modality: e.modality,
      })),
      shapes: [],
      chosen: [],
    };
    return { facts: facts as FactRecord, display };
  }
};

const tug = (towM: number, day = false) =>
  record({
    'fact:propulsion': 'propulsion:power',
    ...underway,
    'fact:activity': 'activity:towing',
    'fact:length_m': 30,
    'fact:tow_length_m': towM,
    ...(day ? { 'fact:time': 'time:day' } : {}),
  });
const barge = (towM: number, day = false) =>
  record({
    ...underway,
    'fact:activity': 'activity:being_towed',
    'fact:length_m': 40,
    'fact:tow_length_m': towM,
    ...(day ? { 'fact:time': 'time:day' } : {}),
  });
const pushing = (composite: boolean, lengthM = 30) =>
  record({
    'fact:propulsion': 'propulsion:power',
    ...underway,
    'fact:activity': 'activity:pushing',
    'fact:composite_unit': composite,
    'fact:length_m': lengthM,
  });
const pushedBarge = () =>
  record24f(
    {
      ...underway,
      'fact:activity': 'activity:being_towed',
      'fact:tow_rigidity': 'tow_rigidity:pushed_ahead',
      'fact:length_m': 60,
    },
    'rule:24f_i',
  );

const count = (g: { placed: { lightId: string }[] }, id: string) =>
  g.placed.filter((l) => l.lightId === id).length;
const plan = (g: TowGroup) => renderToStaticMarkup(<TowPlanView group={g} threshold={threshold} />);
const profile = (g: TowGroup, time: 'day' | 'night' = 'night') =>
  renderToStaticMarkup(<TowProfileView group={g} threshold={threshold} time={time} />);

describe('24(a)(i) threshold comes from colregs', () => {
  it('reads 200 m, two masthead lights at or under it and three over it', () => {
    expect(threshold).toEqual({
      thresholdM: 200,
      mastheadAtOrUnder: 2,
      mastheadOver: 3,
      entries: ['rule:24a_i', 'rule:24a_i:exceeds_200m'],
    });
  });
  it('is undefined for data with no such pair, so no marker is guessed', () => {
    expect(towThreshold({ entries: [] })).toBeUndefined();
  });
});

describe('tug and barge astern', () => {
  it.each([
    [150, threshold.mastheadAtOrUnder, 'false'],
    [250, threshold.mastheadOver, 'true'],
  ] as const)('a %d m tow: the tug shows %d masthead lights', (towM, masthead, over) => {
    const g = towGroupFromRecords(tug(towM), [barge(towM)], data);
    expect(g.lead.hull).toBe(allHulls.tug);
    expect(count(g.lead, 'light:masthead')).toBe(masthead);
    // 24(a)(iii)-(iv): towing light above the sternlight, and her sidelights
    expect(count(g.lead, 'light:towing')).toBe(1);
    expect(count(g.lead, 'light:sternlight')).toBe(1);
    const m = g.members[0]!;
    expect(m.tie).toBe('astern');
    expect(m.vessel.hull).toBe(allHulls.barge);
    // 24(e): the towed vessel's sidelights and sternlight, no masthead light
    expect(count(m.vessel, 'light:sternlight')).toBe(1);
    expect(count(m.vessel, 'light:masthead')).toBe(0);
    expect(m.vessel.placed.some((l) => l.lightId.startsWith('light:side'))).toBe(true);
    // the line is the tow length less the barge's own length
    expect(m.lineM).toBe(towM - 40);
    expect(towLayout(g).tow!.lengthM).toBeCloseTo(towM);
    const html = plan(g);
    expect(html).toContain(`data-tow-length="${towM}"`);
    expect(html).toContain(`data-tow-over-threshold="${over}"`);
    expect(html).toContain('data-threshold="200"');
    expect(html).toContain('data-tow-line="0"');
    expect(html).not.toContain('NaN');
    expect(profile(g)).not.toContain('NaN');
  });

  it('by day over 200 m both the tug and the tow carry the diamond, and not at 150 m', () => {
    const over = towGroupFromRecords(tug(250, true), [barge(250, true)], data);
    expect(over.lead.shapes!.map((s) => s.shapeId)).toEqual(['shape:diamond']);
    expect(over.members[0]!.vessel.shapes!.map((s) => s.shapeId)).toEqual(['shape:diamond']);
    const html = profile(over, 'day');
    expect(html.match(/data-shape="shape:diamond"/g)).toHaveLength(2);
    const under = towGroupFromRecords(tug(150, true), [barge(150, true)], data);
    expect(under.lead.shapes).toEqual([]);
    expect(profile(under, 'day')).not.toContain('shape:diamond');
  });
});

describe('pushed groups', () => {
  // 24(b) regards the unit as one power-driven vessel, so her record carries
  // the unit's length and 23(a) is evaluated for it; the pusher's own length
  // only scales her drawing.
  const composite = (pusherM: number, bargeM: number) =>
    towGroupFromRecords(
      { ...pushing(true, pusherM + bargeM), lengthM: pusherM },
      [record({ ...underway, 'fact:activity': 'activity:being_towed', 'fact:length_m': bargeM })],
      data,
    );

  it('a composite unit (24(b)) is one power-driven vessel with one set of lights', () => {
    const g = composite(30, 60);
    expect(g.composite).toBe(true);
    expect(g.lead.hull).toBe(allHulls.pusher);
    expect(g.lead.lengthM).toBe(30);
    // 23(a) for a 90 m unit: a second masthead light abaft (23(a)(ii)), sidelights, sternlight
    expect(count(g.lead, 'light:masthead')).toBe(2);
    expect(count(g.lead, 'light:sternlight')).toBe(1);
    expect(g.members[0]!.tie).toBe('pushed_ahead');
    expect(g.members[0]!.vessel.placed).toEqual([]);
    const lit = [g.lead, ...g.members.map((m) => m.vessel)].filter((v) => v.placed.length > 0);
    expect(lit).toHaveLength(1);
    const lay = towLayout(g);
    expect(lay.maxM - lay.minM).toBeCloseTo(90);
    const html = plan(g);
    expect(html).toContain('data-composite="true"');
    expect(html).toContain('data-contact="pushed_ahead"');
    expect(html).not.toContain('data-tow-length');
  });

  it('a composite unit under 50 m overall shows one masthead light', () => {
    expect(count(composite(20, 25).lead, 'light:masthead')).toBe(1);
  });

  it('pushing ahead, not composite: 24(c) on the pusher and 24(f)(i) on the barge', () => {
    const g = towGroupFromRecords(pushing(false), [pushedBarge()], data);
    expect(g.composite).toBeUndefined();
    expect(count(g.lead, 'light:masthead')).toBe(2);
    expect(count(g.lead, 'light:sternlight')).toBe(1);
    const b = g.members[0]!;
    expect(b.tie).toBe('pushed_ahead');
    // 24(f)(i): sidelights at the forward end, in lieu of 24(e), so no sternlight
    expect(count(b.vessel, 'light:sternlight')).toBe(0);
    expect(b.vessel.placed.some((l) => l.lightId.startsWith('light:side'))).toBe(true);
    const lay = towLayout(g);
    expect(lay.hulls[1]!.sternM).toBeCloseTo(lay.hulls[0]!.bowM);
    expect(plan(g)).not.toContain('NaN');
  });

  it('a partly submerged object astern draws the awash hull', () => {
    const g = towGroupFromRecords(
      tug(150),
      [
        record({
          ...underway,
          'fact:inconspicuous_partly_submerged_tow': true,
          'fact:length_m': 40,
        }),
      ],
      data,
    );
    expect(g.members[0]!.vessel.hull).toBe(allHulls.partlySubmerged);
    expect(g.members[0]!.tie).toBe('astern');
    expect(profile(g)).toContain('data-hull="partly-submerged"');
  });
});

describe('layoutTow', () => {
  const spec = { bowX: 0.9, sternX: -0.9, beam: 0.2 };
  it('strings astern hulls on their lines, and puts alongside hulls stern-level beside the lead', () => {
    const lay = layoutTow({ spec, lengthM: 30 }, [
      { spec, lengthM: 40, tie: 'astern', lineM: 100 },
      { spec, lengthM: 20, tie: 'alongside' },
    ]);
    const [lead, astern, along] = lay.hulls;
    expect(lead!.sternM).toBeCloseTo(-15);
    expect(astern!.bowM).toBeCloseTo(-115);
    expect(astern!.sternM).toBeCloseTo(-155);
    expect(lay.tow!.lengthM).toBeCloseTo(140);
    expect(along!.sternM).toBeCloseTo(lead!.sternM);
    expect(along!.yM).toBeCloseTo(lead!.halfBeamM + along!.halfBeamM);
  });
});

describe('public entry', () => {
  it('exports the tow scene and its geometry', () => {
    for (const k of [
      'TowPlanView',
      'TowProfileView',
      'towGroupFromRecords',
      'towLayout',
      'layoutTow',
      'towThreshold',
    ])
      expect(entry).toHaveProperty(k);
  });
});
