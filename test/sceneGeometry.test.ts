import { describe, expect, it } from 'vitest';
import { fitScale, pairLayout, toScreen } from '../src/sceneGeometry.js';

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

  it('toScreen puts north up and east right', () => {
    const [x, y] = toScreen(10, 10, 2, { x: 100, y: 100 });
    near(x, 120);
    near(y, 80);
  });
});
