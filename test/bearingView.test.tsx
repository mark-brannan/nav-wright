// BearingView's default is the strict exam presentation: lights only, on
// black. The seascape (horizon, sea) and the range-faded hull hint are
// opt-in, and the hull silhouette foreshortens with theta.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BearingView,
  HULL_HINT_FAR_NM,
  HULL_HINT_NEAR_NM,
  SKY_LIGHT,
  hullHintOpacity,
  hullSilhouette,
  skyColor,
} from '../src/BearingView.js';
import { selectHull } from '../src/hulls.js';
import type { PlacedLight } from '../src/placement.js';
import type { SectorProfile } from '../src/sectorProfile.js';
import { ANNEX_I_PROFILE } from '../src/sectorProfile.js';
import type { FactRecord } from 'colregs-engine';

const facts: FactRecord = {};
const hull = selectHull(facts);
const noop = () => {};

const render = (props: {
  hullHint?: number;
  range?: number;
  seascape?: boolean;
  theta?: number;
  sky?: number;
}): string =>
  renderToStaticMarkup(
    <BearingView
      hull={hull}
      placed={[]}
      theta={props.theta ?? 0}
      onTheta={noop}
      hullHint={props.hullHint ?? 0}
      range={props.range}
      seascape={props.seascape}
      sky={props.sky}
    />,
  );

const hintOpacity = (html: string): number | undefined => {
  const tag = /<path[^>]*class="bearing-hull-hint"[^>]*>/.exec(html)?.[0];
  const v = tag && /opacity="([^"]*)"/.exec(tag)?.[1];
  return v === undefined || v === null || v === '' ? undefined : Number(v);
};

const skyFill = (html: string): string | undefined =>
  /<rect[^>]*class="bearing-sky"[^>]*fill="([^"]*)"/.exec(html)?.[1];

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.2126 + ((n >> 8) & 0xff) * 0.7152 + (n & 0xff) * 0.0722;
};

const width = (pts: [number, number][]): number => {
  const xs = pts.map(([x]) => x);
  return Math.max(...xs) - Math.min(...xs);
};

describe('BearingView presentation', () => {
  it('defaults to lights only on black: no horizon, no sea', () => {
    const html = render({});
    expect(html).not.toContain('bearing-horizon');
    expect(html).not.toContain('bearing-sea');
    expect(html).not.toContain('linearGradient');
    expect(html).not.toContain('bearing-hull-hint');
    expect(html).toContain('fill="#000000"');
  });

  it('seascape adds a horizon and a sea and keeps the black sky', () => {
    const html = render({ seascape: true });
    expect(html).toContain('class="bearing-horizon"');
    expect(html).toContain('class="bearing-sea"');
    expect(html).toContain('fill="#000000"');
  });

  it('gives each seascape on a page its own gradient id', () => {
    const two = renderToStaticMarkup(
      <>
        <BearingView hull={hull} placed={[]} theta={0} onTheta={noop} hullHint={0} seascape />
        <BearingView hull={hull} placed={[]} theta={0} onTheta={noop} hullHint={0} seascape />
      </>,
    );
    const ids = [...two.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('draws the hull hint on its own, without the seascape', () => {
    const html = render({ hullHint: 1, range: 0.5 });
    expect(html).toContain('bearing-hull-hint');
    expect(html).not.toContain('bearing-sea');
  });
});

describe('hull hint strength', () => {
  it('draws nothing at strength 0', () => {
    expect(render({ hullHint: 0, range: 0.5 })).not.toContain('bearing-hull-hint');
  });

  it('scales the range fade: stronger setting, more visible hull, never past full', () => {
    const faint = hintOpacity(render({ hullHint: 0.3, range: 0.5 }));
    const full = hintOpacity(render({ hullHint: 1, range: 0.5 }));
    expect(faint).toBeCloseTo(0.3, 3);
    expect(full).toBe(1);
    expect(hintOpacity(render({ hullHint: 0.3, range: 1.75 }))).toBeLessThan(faint as number);
    expect(hintOpacity(render({ hullHint: 5, range: 0.5 }))).toBe(1);
  });

  it('is still gone past the far range, however strong the setting', () => {
    expect(render({ hullHint: 1, range: HULL_HINT_FAR_NM })).not.toContain('bearing-hull-hint');
  });
});

describe('sky', () => {
  it('is black by default and at 0', () => {
    expect(skyFill(render({}))).toBe('#000000');
    expect(skyColor(0)).toBe('#000000');
  });

  it('reaches the light night blue at 1 and clamps beyond either end', () => {
    const light = `#${SKY_LIGHT.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
    expect(skyFill(render({ sky: 1 }))).toBe(light);
    expect(skyColor(7)).toBe(light);
    expect(skyColor(-1)).toBe('#000000');
    expect(skyColor(Number.NaN)).toBe('#000000');
  });

  it('only ever brightens as the setting rises, and stays blue', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map(skyColor);
    for (let i = 1; i < steps.length; i++)
      expect(luminance(steps[i])).toBeGreaterThan(luminance(steps[i - 1]));
    const n = parseInt(skyColor(0.5).slice(1), 16);
    expect(n & 0xff).toBeGreaterThan(n >> 16);
  });
});

describe('hull hint opacity by range', () => {
  it('is 0 at 3 nm and above 0 at 0.5 nm', () => {
    expect(hullHintOpacity(3)).toBe(0);
    expect(hullHintOpacity(0.5)).toBeGreaterThan(0);
  });

  it('is full at moonlight range and nearer, and nothing past the far limit', () => {
    expect(hullHintOpacity(HULL_HINT_NEAR_NM)).toBe(1);
    expect(hullHintOpacity(0)).toBe(1);
    expect(hullHintOpacity(HULL_HINT_FAR_NM + 5)).toBe(0);
  });

  it('only ever fades with range', () => {
    const rs = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4];
    const os = rs.map(hullHintOpacity);
    for (let i = 1; i < os.length; i++) expect(os[i]).toBeLessThanOrEqual(os[i - 1]);
    expect(hullHintOpacity(1.75)).toBeGreaterThan(0);
    expect(hullHintOpacity(1.75)).toBeLessThan(1);
  });

  it('is full strength when no range is given', () => {
    expect(hullHintOpacity(undefined)).toBe(1);
  });

  it('shows in the rendered hint: absent at 3 nm, faint at 0.5 nm and fainter in between', () => {
    expect(hintOpacity(render({ hullHint: 1, range: 3 }))).toBeUndefined();
    expect(render({ hullHint: 1, range: 3 })).not.toContain('bearing-hull-hint');
    const near = hintOpacity(render({ hullHint: 1, range: 0.5 }));
    const mid = hintOpacity(render({ hullHint: 1, range: 1.75 }));
    expect(near).toBeGreaterThan(0);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(near as number);
  });
});

describe('hull silhouette aspect', () => {
  it('foreshortens end-on: much narrower at theta 0 and 180 than abeam at 90', () => {
    const abeam = width(hullSilhouette(hull, 90));
    expect(width(hullSilhouette(hull, 0))).toBeLessThan(abeam / 2);
    expect(width(hullSilhouette(hull, 180))).toBeLessThan(abeam / 2);
  });

  it('stands on the waterline, not below it', () => {
    for (const theta of [0, 45, 90, 135, 180, 270]) {
      const ys = hullSilhouette(hull, theta).map(([, y]) => y);
      expect(Math.max(...ys)).toBe(150);
      expect(Math.min(...ys)).toBeLessThan(150);
    }
  });

  it('rakes the bow end abeam and is symmetric end-on', () => {
    const [bl, tl, tr, br] = hullSilhouette(hull, 0);
    expect(tl[0] - bl[0]).toBeCloseTo(br[0] - tr[0], 6);
    const [, tl90, tr90] = hullSilhouette(hull, 90);
    const [bl90, , , br90] = hullSilhouette(hull, 90);
    // bow is to the right abeam from her starboard side
    expect(br90[0] - tr90[0]).toBeGreaterThan(tl90[0] - bl90[0]);
    const [bl270, tl270, tr270, br270] = hullSilhouette(hull, 270);
    expect(tl270[0] - bl270[0]).toBeGreaterThan(br270[0] - tr270[0]);
  });
});

// Annex I §9(a) in the flat view: with a sectorProfile each light's whole
// glow fades across its arc limits (sectorIntensity); without one the cut is
// hard, in arc or not.
describe('BearingView sector softening', () => {
  const lamp = (key: string, color: string, from_deg: number, to_deg: number): PlacedLight => ({
    key,
    lightId: `light:${key}`,
    color,
    character: 'steady',
    arc: { from_deg, to_deg },
    fx: 0.1,
    py: 0.2,
    z: 0.5,
    sourceEntry: 'test',
  });
  const starboard = lamp('starboard', 'green', 0, 112.5);
  const lightOpacities = (theta: number, sectorProfile?: SectorProfile): number[] =>
    [
      ...renderToStaticMarkup(
        <BearingView
          hull={hull}
          placed={[starboard]}
          theta={theta}
          onTheta={noop}
          hullHint={0}
          sectorProfile={sectorProfile}
          controls={false}
        />,
      ).matchAll(/<g opacity="([^"]*)">(?:<g opacity="1">)?<circle/g),
    ].map((m) => Number(m[1]));

  it('without a profile, the hard cut', () => {
    expect(lightOpacities(112.5)).toEqual([1]);
    expect(lightOpacities(113)).toEqual([]);
    expect(lightOpacities(359)).toEqual([]);
  });

  it.each([
    // aft edge: full 5 degrees inside, half at the limit, gone 5 outside
    [100, 1],
    [110, 0.75],
    [112.5, 0.5],
    [115, 0.25],
    [117.5, 0],
    // forward edge (on the bow): full to the limit, gone 2 outside
    [10, 1],
    [0, 1],
    [359, 0.5],
    [358, 0],
  ])('at %s the starboard light reads %s', (theta, want) => {
    const got = lightOpacities(theta, ANNEX_I_PROFILE);
    if (want === 0) expect(got).toEqual([]);
    else {
      expect(got).toHaveLength(1);
      expect(got[0]).toBeCloseTo(want, 6);
    }
  });

  it('a light faded to nothing leaves the empty-scene note', () => {
    expect(
      renderToStaticMarkup(
        <BearingView
          hull={hull}
          placed={[starboard]}
          theta={180}
          onTheta={noop}
          hullHint={0}
          sectorProfile={ANNEX_I_PROFILE}
        />,
      ),
    ).toContain('bearing-empty');
  });
});
