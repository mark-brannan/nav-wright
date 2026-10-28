// The playground's current look as a props object for BearingModelView or
// BearingView, to paste into a consumer: `<BearingModelView {...look} />`.
// Carries what the URL carries (urlState.ts) that the component takes as a
// prop; a prop at the component's own default is left out. Pure (no window,
// no React) so a test can pin it. The hull, placed lights, model URL and
// handlers are the consumer's own and are not here.

import { K_PRESCRIBED } from '../src/sectorProfile.js';
import { FLASH_ON_S } from '../src/lantern.js';
import { DEFAULT_TILT } from '../src/tilt.js';
import type { UrlState } from './urlState.js';

export type LookComponent = 'BearingModelView' | 'BearingView';

export interface Look {
  component: LookComponent;
  props: Record<string, number | boolean | string>;
}

/** The view tab's component, or null where the tab has none (the profile). */
export function lookComponent(view: string): LookComponent | null {
  if (view === '3d' || view === 'silhouette') return 'BearingModelView';
  if (view === 'bearing') return 'BearingView';
  return null;
}

// The components' own defaults. theta, hullHint and range are always given:
// the first two are required, and the playground always passes a range, where
// the component's default is none.
const MODEL_DEFAULTS = {
  tilt: DEFAULT_TILT,
  sky: 0,
  sea: 0.1,
  glowSize: 1,
  glowFalloff: 0,
  transmissivity: K_PRESCRIBED,
  haze: 0,
} as const;
const BEARING_DEFAULTS = { sky: 0 } as const;

/**
 * @param flashesPerMinute the flash rate the playground passes when its flash
 *   toggle is on (declaredFlashRate); both components take it.
 * @param rangeDropout the playground's range dropout toggle, which is not in
 *   the URL; only the 3D view passes it, and without it K changes nothing.
 */
export function lookProps(
  state: UrlState,
  flashesPerMinute?: number,
  rangeDropout = false,
): Look | null {
  const component = lookComponent(state.view);
  if (component === null) return null;
  const props: Look['props'] = {
    theta: state.theta,
    hullHint: state.hullHint,
    range: state.range,
  };
  if (component === 'BearingModelView') {
    if (state.tilt !== MODEL_DEFAULTS.tilt) props.tilt = state.tilt;
    if (state.sky !== MODEL_DEFAULTS.sky) props.sky = state.sky;
    if (state.sea !== MODEL_DEFAULTS.sea) props.sea = state.sea;
    for (const k of ['glowSize', 'glowFalloff', 'transmissivity', 'haze'] as const) {
      if (state[k] !== MODEL_DEFAULTS[k]) props[k] = state[k];
    }
    if (state.rangeGlow) props.rangeGlow = true;
    if (rangeDropout && state.view === '3d') props.rangeDropout = true;
    // the silhouette is drawn at tilt 0, so it carries none; 'all' is the playground's side-by-side of the three, not one look
    if (state.view === 'silhouette' && state.variant !== 'all') props.silhouette = state.variant;
    if (state.singleLantern) props.singleLantern = true;
    if (state.flashRateOn && flashesPerMinute !== undefined) {
      props.flashesPerMinute = flashesPerMinute;
    }
    if (state.flashOnSeconds !== FLASH_ON_S) props.flashOnSeconds = state.flashOnSeconds;
  } else {
    if (state.sky !== BEARING_DEFAULTS.sky) props.sky = state.sky;
    if (state.singleLantern) props.singleLantern = true;
    if (state.rangeGlow) props.rangeGlow = true;
    if (state.flashRateOn && flashesPerMinute !== undefined) {
      props.flashesPerMinute = flashesPerMinute;
    }
  }
  return { component, props };
}

/** The props as a pasteable object literal, one prop per line. */
export function formatLook(look: Look): string {
  const lines = Object.entries(look.props).map(
    ([k, v]) => `  ${k}: ${typeof v === 'string' ? `'${v}'` : String(v)},`,
  );
  return `{\n${lines.join('\n')}\n}`;
}
