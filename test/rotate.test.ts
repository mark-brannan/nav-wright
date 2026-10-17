// θ is a circle: every way of turning the viewer wraps through 359 to 0.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { thetaAfterDrag, thetaAtPoint, wrapDegrees } from '../src/rotate.js';
import { THETA_PAGE_STEP, ThetaControl, thetaForKey, thetaFromInput } from '../src/ThetaControl.js';
import { defaultSceneLabels } from '../src/labels.js';

describe('wrapDegrees', () => {
  it.each([
    [0, 0],
    [359, 359],
    [360, 0],
    [361, 1],
    [-1, 359],
    [-721, 359],
  ])('%d folds to %d', (input, out) => {
    expect(wrapDegrees(input)).toBe(out);
  });
});

describe('dragging the vessel', () => {
  it('one surface height of rightward drag is a full turn back to the start', () => {
    expect(thetaAfterDrag(45, 240, 240)).toBe(45);
  });

  it('a rightward drag increases θ, as the 3D orbit does', () => {
    expect(thetaAfterDrag(90, 60, 240)).toBe(180);
  });

  it('carries on past 359 into 0 and past 0 into 359', () => {
    expect(thetaAfterDrag(350, 20, 360)).toBe(10);
    expect(thetaAfterDrag(10, -20, 360)).toBe(350);
  });

  it('ignores a surface with no height', () => {
    expect(thetaAfterDrag(30, 100, 0)).toBe(30);
  });
});

describe('the dial', () => {
  it.each([
    [0, -10, 0],
    [10, 0, 90],
    [0, 10, 180],
    [-10, 0, 270],
    [-10, -10, 315],
  ])('a point at (%d, %d) from centre is θ %d, bow up, starboard right', (x, y, theta) => {
    expect(thetaAtPoint(x, y)).toBe(theta);
  });

  it('the hidden input wraps one step past either end', () => {
    expect(thetaFromInput(360)).toBe(0);
    expect(thetaFromInput(-1)).toBe(359);
    expect(thetaFromInput(200)).toBe(200);
  });

  it('PageUp and PageDown step and wrap; Home and End land on 0 and 359', () => {
    expect(thetaForKey(350, 'PageUp')).toBe((350 + THETA_PAGE_STEP) % 360);
    expect(thetaForKey(5, 'PageDown')).toBe(360 + 5 - THETA_PAGE_STEP);
    expect(thetaForKey(123, 'Home')).toBe(0);
    expect(thetaForKey(123, 'End')).toBe(359);
    expect(thetaForKey(123, 'ArrowRight')).toBeNull();
  });

  it('a θ of 360 shows as 0, and the eye sits on her starboard side at 90', () => {
    const html = (theta: number) =>
      renderToStaticMarkup(
        createElement(ThetaControl, { theta, onTheta: () => {}, labels: defaultSceneLabels }),
      );
    expect(html(360)).toMatch(/<input[^>]*value="0"/);
    const eye = /class="theta-dial-eye" cx="([^"]+)" cy="([^"]+)"/.exec(html(90));
    expect(Number(eye?.[1])).toBeGreaterThan(30);
    expect(Math.abs(Number(eye?.[2]))).toBeLessThan(1e-6);
  });
});
