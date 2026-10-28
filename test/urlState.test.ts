import { describe, expect, it } from 'vitest';
import { DEFAULT_TILT } from '../src/tilt.js';
import {
  URL_DEFAULTS,
  decodeUrlState,
  encodeUrlState,
  type UrlState,
} from '../playground/urlState.js';

const options = {
  views: ['3d', 'silhouette', 'profile', 'bearing'],
  variants: ['all', 'mesh', 'soft'],
};

const changed: UrlState = {
  view: 'silhouette',
  variant: 'soft',
  theta: 112.5,
  tilt: -20,
  hullHint: 0.25,
  range: 2.4,
  sky: 0.6,
  sea: 0.35,
  glowSize: 1.5,
  glowFalloff: 0.4,
  transmissivity: 0.5,
  haze: 0.3,
  day: true,
  singleLantern: true,
  rangeGlow: true,
  flashRateOn: true,
};

describe('playground url state', () => {
  it('keeps defaults out of the URL', () => {
    expect(encodeUrlState(URL_DEFAULTS)).toBe('');
    expect(decodeUrlState('', options)).toEqual(URL_DEFAULTS);
    expect(URL_DEFAULTS.tilt).toBe(DEFAULT_TILT);
  });

  it('round-trips every control', () => {
    const search = encodeUrlState(changed);
    expect(decodeUrlState(search, options)).toEqual(changed);
  });

  it('round-trips each control alone', () => {
    for (const k of Object.keys(changed) as (keyof UrlState)[]) {
      const state = { ...URL_DEFAULTS, [k]: changed[k] };
      const search = encodeUrlState(state);
      expect(search).not.toBe('');
      expect(decodeUrlState(search, options)).toEqual(state);
    }
  });

  it('writes the switches as bare flags, so ?day still works', () => {
    expect(encodeUrlState({ ...URL_DEFAULTS, day: true })).toBe('day');
    expect(decodeUrlState('?day', options).day).toBe(true);
  });

  it('leaves keys it does not own, and drops a control back to default', () => {
    expect(encodeUrlState(URL_DEFAULTS, '?yaw&compare&theta=90&day')).toBe('yaw&compare');
  });

  it('falls back on junk and clamps out-of-range numbers', () => {
    const s = decodeUrlState(
      '?view=nope&variant=x&theta=abc&tilt=500&range=-3&sky=&hint=9',
      options,
    );
    expect(s).toEqual({ ...URL_DEFAULTS, tilt: 90, range: 0, hullHint: 1 });
    expect(decodeUrlState('?theta=-90', options).theta).toBe(270);
    expect(decodeUrlState('?halo=9&falloff=-1&k=0&haze=2', options)).toEqual({
      ...URL_DEFAULTS,
      glowSize: 4,
      glowFalloff: 0,
      transmissivity: 0.05,
      haze: 1,
    });
  });
});
