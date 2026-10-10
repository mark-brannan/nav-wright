// BearingView's default is the strict exam presentation: lights only, on
// black. The seascape (horizon, sea) and the range-faded hull hint are
// opt-in, and the hull silhouette foreshortens with theta.

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BearingView,
  HULL_HINT_FAR_NM,
  HULL_HINT_NEAR_NM,
  hullHintOpacity,
  hullSilhouette,
} from '../src/BearingView.js';
import { selectHull } from '../src/hulls.js';
import type { FactRecord } from 'colregs-engine';

const facts: FactRecord = {};
const hull = selectHull(facts);
const noop = () => {};

const render = (props: { hullHint?: boolean; range?: number; seascape?: boolean; theta?: number }): string =>
  renderToStaticMarkup(
    <BearingView
      hull={hull}
      placed={[]}
      theta={props.theta ?? 0}
      onTheta={noop}
      hullHint={props.hullHint ?? false}
      range={props.range}
      seascape={props.seascape}
    />,
  );

const hintOpacity = (html: string): number | undefined => {
  const tag = /<path[^>]*class="bearing-hull-hint"[^>]*>/.exec(html)?.[0];
  const v = tag && /opacity="([^"]*)"/.exec(tag)?.[1];
  return v === undefined || v === null || v === '' ? undefined : Number(v);
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
        <BearingView hull={hull} placed={[]} theta={0} onTheta={noop} hullHint={false} seascape />
        <BearingView hull={hull} placed={[]} theta={0} onTheta={noop} hullHint={false} seascape />
      </>,
    );
    const ids = [...two.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('draws the hull hint on its own, without the seascape', () => {
    const html = render({ hullHint: true, range: 0.5 });
    expect(html).toContain('bearing-hull-hint');
    expect(html).not.toContain('bearing-sea');
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
    expect(hintOpacity(render({ hullHint: true, range: 3 }))).toBeUndefined();
    expect(render({ hullHint: true, range: 3 })).not.toContain('bearing-hull-hint');
    const near = hintOpacity(render({ hullHint: true, range: 0.5 }));
    const mid = hintOpacity(render({ hullHint: true, range: 1.75 }));
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
