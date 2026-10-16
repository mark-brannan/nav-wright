// Single lantern, range-scaled glow and declared flash rate: each is opt-in,
// and the default bearing view is byte-for-byte what it was.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FactRecord } from 'colregs-engine';
import type { LightsData } from 'colregs-engine/schema';
import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import { BearingView } from '../src/BearingView.js';
import { selectHull } from '../src/hulls.js';
import { mergeLanterns } from '../src/lantern.js';
import type { PlacedLight } from '../src/placement.js';
import { declaredFlashRate, flashPeriodSeconds, glowProfile, lightRangesFor } from '../src/svg.js';

const lightsData = lightsJson as unknown as LightsData;
const hull = selectHull({} as FactRecord);

const mk = (over: Partial<PlacedLight>): PlacedLight => ({
  key: 'k',
  lightId: 'light:masthead',
  color: 'white',
  character: 'steady',
  arc: null,
  fx: 0,
  py: 0,
  z: 1,
  sourceEntry: 'rule:25_b',
  ...over,
});
const stbd = mk({
  key: 'k:stbd',
  lightId: 'light:sidelight_starboard',
  color: 'green',
  arc: { from_deg: 0, to_deg: 112.5 },
  py: 0.02,
  combined: true,
});
const port = mk({
  key: 'k:port',
  lightId: 'light:sidelight_port',
  color: 'red',
  arc: { from_deg: 247.5, to_deg: 360 },
  py: -0.02,
  combined: true,
});
const stern = mk({
  key: 'k:stern',
  lightId: 'light:sternlight',
  color: 'white',
  arc: { from_deg: 112.5, to_deg: 247.5 },
  combined: true,
});
const tricolor = [stbd, port, stern];

const view = (placed: PlacedLight[], theta: number, extra: object = {}) =>
  renderToStaticMarkup(
    <BearingView
      hull={hull}
      placed={placed}
      theta={theta}
      onTheta={() => {}}
      hullHint={0}
      {...extra}
    />,
  );
const dots = (html: string) => (html.match(/<g[^>]*opacity="1"/g) ?? []).length;

describe('single lantern', () => {
  it('picks the sector facing the viewer', () => {
    const at = (t: number) => mergeLanterns(tricolor, t).map((l) => l.color);
    expect(at(45)).toEqual(['green']);
    expect(at(300)).toEqual(['red']);
  });
  it('merges a both-sectors-visible bearing into one, first listed on a tie', () => {
    const both = [stbd, port];
    expect(mergeLanterns(both, 0)).toHaveLength(1);
    expect(mergeLanterns(both, 0)[0]!.color).toBe('green');
  });
  it('leaves uncombined lights alone', () => {
    const a = mk({ key: 'a' });
    const b = mk({ key: 'b', z: 0.8 });
    expect(mergeLanterns([a, b], 0)).toEqual([a, b]);
  });
  it('is off by default and draws one glow when on', () => {
    expect(dots(view([stbd, port], 0))).toBe(2);
    expect(dots(view([stbd, port], 0, { singleLantern: true }))).toBe(1);
  });
});

describe('range glow', () => {
  it('a 6 nm masthead blooms wider than a 1 nm sidelight', () => {
    expect(glowProfile(6).scale).toBeGreaterThan(glowProfile(1).scale);
  });
  it('dims toward the light reach, floors at 0.35, and is flat with no range', () => {
    expect(glowProfile(3, 0).opacity).toBe(1);
    expect(glowProfile(3, 3).opacity).toBeCloseTo(0.5);
    expect(glowProfile(3, 30).opacity).toBe(0.35);
    expect(glowProfile(undefined, 2)).toEqual({ scale: 1, opacity: 1 });
  });
  it('reads Rule 22 bands from lights.json', () => {
    const r = lightRangesFor(lightsData, 12);
    expect(r['light:masthead']).toBe(3);
    expect(r['light:sidelight_port']).toBe(2);
    expect(lightRangesFor(lightsData, 60)['light:masthead']).toBe(6);
    expect(lightRangesFor(lightsData, 8)['light:sidelight_starboard']).toBe(1);
  });
  it('is off by default: the markup is unchanged', () => {
    const m = mk({ arc: { from_deg: 247.5, to_deg: 112.5 } });
    const off = view([m], 0);
    expect(view([m], 0, { lightRangesNm: { 'light:masthead': 6 } })).toBe(off);
    expect(view([m], 0, { rangeGlow: true, lightRangesNm: { 'light:masthead': 6 } })).not.toBe(off);
  });
});

describe('flash rate', () => {
  const fl = mk({ lightId: 'light:flashing', character: 'flashing', color: 'yellow' });
  it('reads the declared rate: 120 a minute is a half-second cycle', () => {
    expect(declaredFlashRate(lightsData, 'light:flashing')).toBe(120);
    expect(flashPeriodSeconds(120)).toBe(0.5);
    expect(declaredFlashRate(lightsData, 'light:masthead')).toBeUndefined();
  });
  it('sets the cycle only when asked', () => {
    expect(view([fl], 0)).not.toContain('animation-duration');
    expect(view([fl], 0, { flashesPerMinute: 60 })).toContain('animation-duration:1s');
  });
});
