// The merged bearing-and-3D view must keep the exam's meaning: a viewer at
// relative bearing theta sees only the lights whose arc holds theta. The
// canvas itself needs WebGL, so what is pinned here is the rule both views
// filter through (lightsInView) and the view's own chrome around the canvas.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BearingModelView, bearingHullOpacity } from '../src/BearingModelView.js';
import { BearingView } from '../src/BearingView.js';
import { selectHull } from '../src/hulls.js';
import type { PlacedLight } from '../src/placement.js';
import { lightsInView } from '../src/placement.js';

const light = (lightId: string, color: string, from_deg: number, to_deg: number): PlacedLight => ({
  key: lightId,
  lightId,
  color,
  character: 'steady',
  arc: { from_deg, to_deg },
  fx: 0,
  py: 0,
  z: 0.5,
  sourceEntry: 'test',
});

const masthead = light('light:masthead', '#ffffff', 247.5, 112.5);
const starboard = light('light:sidelight_starboard', '#00ff00', 0, 112.5);
const port = light('light:sidelight_port', '#ff0000', 247.5, 360);
const stern = light('light:sternlight', '#ffffff', 112.5, 247.5);
const underway = [masthead, starboard, port, stern];

const ids = (ls: PlacedLight[]) => ls.map((l) => l.lightId).sort();

describe('lightsInView', () => {
  it.each([
    [0, [masthead, starboard, port]],
    [45, [masthead, starboard]],
    [112.5, [masthead, starboard, stern]],
    [180, [stern]],
    [300, [masthead, port]],
    [359, [masthead, port]],
  ])('at theta %s shows only the lights whose arc holds it', (theta, expected) => {
    expect(ids(lightsInView(underway, theta))).toEqual(ids(expected));
  });

  it('keeps a light with no prescribed arc at every bearing', () => {
    const allRound = { ...stern, key: 'all-round', arc: null };
    for (const theta of [0, 90, 180, 270]) {
      expect(lightsInView([allRound], theta)).toEqual([allRound]);
    }
  });
});

const hull = selectHull({});
const noop = () => {};
const render = (theta: number, placed: PlacedLight[] = underway, sky?: number): string =>
  renderToStaticMarkup(
    <BearingModelView
      modelUrl="/nowhere.glb"
      hull={hull}
      placed={placed}
      facts={{}}
      theta={theta}
      onTheta={noop}
      hullHint={0.3}
      sky={sky}
    />,
  );

describe('BearingModelView', () => {
  it('says no lights are visible when none is in arc', () => {
    expect(render(180, [masthead])).toContain('bearing-empty-overlay');
  });

  it('says nothing when a light is in arc', () => {
    expect(render(0, [masthead])).not.toContain('bearing-empty-overlay');
  });

  it('agrees with the 2D bearing view on when nothing is visible', () => {
    for (const theta of [0, 90, 112.5, 135, 180, 247.5, 300]) {
      const flat = renderToStaticMarkup(
        <BearingView hull={hull} placed={[masthead]} theta={theta} onTheta={noop} hullHint={0} />,
      ).includes('bearing-empty');
      expect(render(theta, [masthead]).includes('bearing-empty-overlay'), `theta ${theta}`).toBe(
        flat,
      );
    }
  });

  it('paints the sky behind the canvas before the model loads', () => {
    expect(render(0, underway, 1)).toContain('background:#3a6593');
  });

  it('feeds its visibility K to the range dropout', () => {
    const at = (transmissivity?: number) =>
      renderToStaticMarkup(
        <BearingModelView
          modelUrl="/nowhere.glb"
          hull={hull}
          placed={[masthead]}
          facts={{}}
          theta={0}
          onTheta={noop}
          hullHint={0}
          range={2.5}
          rangeDropout
          lightRangesNm={{ 'light:masthead': 2 }}
          transmissivity={transmissivity}
        />,
      );
    expect(at()).not.toContain('bearing-empty-overlay');
    expect(at(0.8)).toBe(at());
    expect(at(0.05)).toContain('bearing-empty-overlay');
  });

  it('draws the same markup with every glow and haze prop at its default', () => {
    const given = renderToStaticMarkup(
      <BearingModelView
        modelUrl="/nowhere.glb"
        hull={hull}
        placed={underway}
        facts={{}}
        theta={45}
        onTheta={noop}
        hullHint={0.3}
        glowSize={1}
        glowFalloff={0}
        rangeGlow={false}
        haze={0}
        transmissivity={0.8}
      />,
    );
    expect(given).toBe(render(45));
  });

  it('names the bearing it is seen from', () => {
    expect(render(135)).toContain('135');
  });
});

describe('bearingHullOpacity', () => {
  it('is the hull hint at close range', () => {
    expect(bearingHullOpacity(0.4, 0.2)).toBeCloseTo(0.4);
  });

  it('is zero when the hint is off or she is far off', () => {
    expect(bearingHullOpacity(0, 0.2)).toBe(0);
    expect(bearingHullOpacity(1, 10)).toBe(0);
  });

  it('clamps a hint outside 0..1 and reads nonsense as off', () => {
    expect(bearingHullOpacity(5)).toBe(1);
    expect(bearingHullOpacity(-1)).toBe(0);
    expect(bearingHullOpacity(Number.NaN)).toBe(0);
  });
});
