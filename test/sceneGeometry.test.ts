import { describe, expect, it } from 'vitest';
import { fitScale, pairFromPositions, pairLayout, toScreen } from '../src/sceneGeometry.js';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('pairLayout', () => {
  it('head-on: target dead ahead, heading reciprocal, own ship dead ahead of it', () => {
    const l = pairLayout({ ownHeading: 0, targetHeading: 180, relativeBearing: 0, rangeM: 1000 });
    near(l.trueBearing, 0);
    near(l.target.east, 0);
    near(l.target.north, 1000);
    near(l.ownFromTarget, 0);
  });

  it('crossing: target on own starboard beam, heading across', () => {
    const l = pairLayout({ ownHeading: 0, targetHeading: 270, relativeBearing: 90, rangeM: 500 });
    near(l.target.east, 500);
    near(l.target.north, 0);
    near(l.reciprocalBearing, 270);
    // target heading west sees own ship (to its west) dead ahead
    near(l.ownFromTarget, 0);
  });

  it('overtaking: target fine on own bow, same heading, own ship astern of it', () => {
    const l = pairLayout({ ownHeading: 90, targetHeading: 90, relativeBearing: 0, rangeM: 300 });
    near(l.trueBearing, 90);
    near(l.target.east, 300);
    near(l.ownFromTarget, 180);
  });

  it('adds relative bearing to heading and wraps through north', () => {
    const l = pairLayout({ ownHeading: 350, targetHeading: 0, relativeBearing: 20, rangeM: 1 });
    near(l.trueBearing, 10);
    const m = pairLayout({ ownHeading: 10, targetHeading: 0, relativeBearing: -20, rangeM: 1 });
    near(m.trueBearing, 350);
  });

  it('keeps range: the offset magnitude equals rangeM', () => {
    const l = pairLayout({ ownHeading: 37, targetHeading: 5, relativeBearing: 211, rangeM: 1234 });
    near(Math.hypot(l.target.east, l.target.north), 1234);
  });
});

describe('frame', () => {
  it('fitScale leaves the pair inside the frame', () => {
    const s = fitScale(2000, 400, 0);
    near(s * 2000, 400);
    near(fitScale(0, 400, 100), 2);
  });

  it('fitScale stays finite for a pair at zero range with no margin', () => {
    expect(Number.isFinite(fitScale(0, 400, 0))).toBe(true);
  });

  it('toScreen puts north up and east right', () => {
    const [x, y] = toScreen(10, 10, 2, { x: 100, y: 100 });
    near(x, 120);
    near(y, 80);
  });
});

describe('pairFromPositions', () => {
  it('target due north one arc-minute away: 1 nm dead ahead of a north-heading own ship', () => {
    const p = pairFromPositions(
      { latitude: 50, longitude: -1 },
      { latitude: 50 + 1 / 60, longitude: -1 },
      0,
      180,
    );
    near(p.relativeBearing, 0);
    expect(p.rangeM).toBeCloseTo(1853.2, 0);
  });

  it('target due east, own heading east: dead ahead; heading north: on the starboard beam', () => {
    const own = { latitude: 0, longitude: 0 };
    const tgt = { latitude: 0, longitude: 0.01 };
    near(pairFromPositions(own, tgt, 90, 270).relativeBearing, 0);
    near(pairFromPositions(own, tgt, 0, 270).relativeBearing, 90);
  });

  it('wraps longitude across the antimeridian', () => {
    const p = pairFromPositions(
      { latitude: 0, longitude: 179.995 },
      { latitude: 0, longitude: -179.995 },
      0,
      0,
    );
    near(p.relativeBearing, 90);
    expect(p.rangeM).toBeLessThan(2000);
  });

  it('feeds pairLayout: the offset points the way the positions do', () => {
    const l = pairLayout(
      pairFromPositions({ latitude: 10, longitude: 10 }, { latitude: 9.99, longitude: 10 }, 30, 0),
    );
    near(l.trueBearing, 180);
    expect(l.target.north).toBeLessThan(0);
  });
});
