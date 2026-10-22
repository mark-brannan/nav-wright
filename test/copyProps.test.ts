import { describe, expect, it } from 'vitest';
import { DEFAULT_TILT } from '../src/tilt.js';
import { formatLook, lookComponent, lookProps } from '../playground/copyProps.js';
import { URL_DEFAULTS, type UrlState } from '../playground/urlState.js';

const at = (over: Partial<UrlState>): UrlState => ({ ...URL_DEFAULTS, ...over });

describe('lookProps', () => {
  it('a bare 3d view carries only the required props', () => {
    expect(lookProps(URL_DEFAULTS)).toEqual({
      component: 'BearingModelView',
      props: { theta: 45, hullHint: 0.5, range: 0.5 },
    });
  });

  it('omits tilt, sky and sea at the component defaults and keeps them otherwise', () => {
    const same = lookProps(at({ tilt: DEFAULT_TILT, sky: 0, sea: 0.1 }));
    expect(same?.props).not.toHaveProperty('tilt');
    expect(same?.props).not.toHaveProperty('sky');
    expect(same?.props).not.toHaveProperty('sea');
    const moved = lookProps(at({ theta: 112.5, tilt: -20, hullHint: 0.25, sky: 0.4, sea: 0.8 }));
    expect(moved?.props).toEqual({
      theta: 112.5,
      hullHint: 0.25,
      range: 0.5,
      tilt: -20,
      sky: 0.4,
      sea: 0.8,
    });
  });

  it('a silhouette variant becomes the silhouette prop; "all" is not one look', () => {
    expect(lookProps(at({ view: 'silhouette', variant: 'soft' }))?.props.silhouette).toBe('soft');
    expect(lookProps(at({ view: 'silhouette', variant: 'all' }))?.props).not.toHaveProperty(
      'silhouette',
    );
    expect(lookProps(at({ view: '3d', variant: 'soft' }))?.props).not.toHaveProperty('silhouette');
  });

  it('the bearing view takes its flags and the flash rate, not tilt or sea', () => {
    const look = lookProps(
      at({
        view: 'bearing',
        sky: 0.3,
        sea: 0.9,
        tilt: 30,
        singleLantern: true,
        rangeGlow: true,
        flashRateOn: true,
      }),
      30,
    );
    expect(look).toEqual({
      component: 'BearingView',
      props: {
        theta: 45,
        hullHint: 0.5,
        range: 0.5,
        sky: 0.3,
        singleLantern: true,
        rangeGlow: true,
        flashesPerMinute: 30,
      },
    });
    expect(lookProps(at({ view: 'bearing' }))?.props).toEqual({
      theta: 45,
      hullHint: 0.5,
      range: 0.5,
    });
  });

  it('the 3D view carries glow, falloff, range glow, K and haze off their defaults', () => {
    const bare = lookProps(at({ glowSize: 1, glowFalloff: 0, transmissivity: 0.8, haze: 0 }));
    expect(bare?.props).toEqual({ theta: 45, hullHint: 0.5, range: 0.5 });
    const look = lookProps(
      at({ glowSize: 1.5, glowFalloff: 0.4, rangeGlow: true, transmissivity: 0.5, haze: 0.3 }),
    );
    expect(look).toEqual({
      component: 'BearingModelView',
      props: {
        theta: 45,
        hullHint: 0.5,
        range: 0.5,
        glowSize: 1.5,
        glowFalloff: 0.4,
        transmissivity: 0.5,
        haze: 0.3,
        rangeGlow: true,
      },
    });
    expect(lookProps(at({ view: 'bearing', haze: 0.3, glowSize: 2 }))?.props).toEqual({
      theta: 45,
      hullHint: 0.5,
      range: 0.5,
    });
  });

  it('carries rangeDropout when the dropout toggle is on, on the 3D view only', () => {
    expect(lookProps(at({ transmissivity: 0.5 }), undefined, true)?.props).toEqual({
      theta: 45,
      hullHint: 0.5,
      range: 0.5,
      transmissivity: 0.5,
      rangeDropout: true,
    });
    expect(lookProps(at({}), undefined, false)?.props).not.toHaveProperty('rangeDropout');
    expect(lookProps(at({}))?.props).not.toHaveProperty('rangeDropout');
    for (const view of ['silhouette', 'bearing']) {
      expect(lookProps(at({ view }), undefined, true)?.props).not.toHaveProperty('rangeDropout');
    }
  });

  it('the 3d view carries single lantern, flash rate and flash on-time, at their defaults left out', () => {
    expect(
      lookProps(at({ singleLantern: true, flashRateOn: true, flashOnSeconds: 0.2 }), 120)?.props,
    ).toEqual({
      theta: 45,
      hullHint: 0.5,
      range: 0.5,
      singleLantern: true,
      flashesPerMinute: 120,
      flashOnSeconds: 0.2,
    });
    const bare = lookProps(at({}), undefined)?.props;
    expect(bare).not.toHaveProperty('singleLantern');
    expect(bare).not.toHaveProperty('flashesPerMinute');
    expect(bare).not.toHaveProperty('flashOnSeconds');
    expect(lookProps(at({ view: 'bearing', flashOnSeconds: 0.2 }))?.props).not.toHaveProperty(
      'flashOnSeconds',
    );
  });

  it('the profile view has no component', () => {
    expect(lookComponent('profile')).toBeNull();
    expect(lookProps(at({ view: 'profile' }))).toBeNull();
  });
});

describe('formatLook', () => {
  it('prints a pasteable object literal', () => {
    const look = lookProps(at({ view: 'silhouette', variant: 'block', theta: 10 }))!;
    expect(formatLook(look)).toBe(
      "{\n  theta: 10,\n  hullHint: 0.5,\n  range: 0.5,\n  silhouette: 'block',\n}",
    );
  });
});
