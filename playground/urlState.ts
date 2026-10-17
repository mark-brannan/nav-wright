// The playground's controls as a query string: a pasted link reopens the same
// look. Pure (no window, no React) so a test can round-trip it. Defaults stay
// out of the URL, so a bare link is unchanged. Keys it does not own are left
// as they are.

import { DEFAULT_TILT, MAX_TILT, MIN_TILT } from '../src/tilt.js';

export interface UrlState {
  view: string;
  variant: string;
  theta: number;
  tilt: number;
  hullHint: number;
  range: number;
  sky: number;
  sea: number;
  day: boolean;
  singleLantern: boolean;
  rangeGlow: boolean;
  flashRateOn: boolean;
}

export const URL_DEFAULTS: UrlState = {
  view: '3d',
  variant: 'all',
  theta: 45,
  tilt: DEFAULT_TILT,
  hullHint: 0.5,
  range: 0.5,
  sky: 0,
  sea: 0.1,
  day: false,
  singleLantern: false,
  rangeGlow: false,
  flashRateOn: false,
};

/** Which values a view or variant may take. */
export interface UrlOptions {
  views: readonly string[];
  variants: readonly string[];
}

const NUMBERS = {
  theta: 'theta',
  tilt: 'tilt',
  hullHint: 'hint',
  range: 'range',
  sky: 'sky',
  sea: 'sea',
} as const;
const FLAGS = {
  day: 'day',
  singleLantern: 'lantern',
  rangeGlow: 'glow',
  flashRateOn: 'flash',
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const wrap360 = (n: number) => (((Math.round(n * 2) / 2) % 360) + 360) % 360;
const NUMBER_BOUNDS: Record<keyof typeof NUMBERS, (n: number) => number> = {
  theta: wrap360,
  tilt: (n) => clamp(n, MIN_TILT, MAX_TILT),
  hullHint: (n) => clamp(n, 0, 1),
  range: (n) => clamp(n, 0, 5),
  sky: (n) => clamp(n, 0, 1),
  sea: (n) => clamp(n, 0, 1),
};

/** Read the playground state out of a query string; anything missing or
 *  unreadable falls back to its default. */
export function decodeUrlState(search: string, options: UrlOptions): UrlState {
  const q = new URLSearchParams(search);
  const state: UrlState = { ...URL_DEFAULTS };
  const view = q.get('view');
  if (view !== null && options.views.includes(view)) state.view = view;
  const variant = q.get('variant');
  if (variant !== null && options.variants.includes(variant)) state.variant = variant;
  for (const k of Object.keys(NUMBERS) as (keyof typeof NUMBERS)[]) {
    const raw = q.get(NUMBERS[k]);
    if (raw === null || raw.trim() === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) state[k] = NUMBER_BOUNDS[k](n);
  }
  for (const k of Object.keys(FLAGS) as (keyof typeof FLAGS)[]) state[k] = q.has(FLAGS[k]);
  return state;
}

/** Write the state into a query string: set what differs from the default,
 *  delete what matches it, leave every other key (yaw, compare) alone. */
export function encodeUrlState(state: UrlState, search = ''): string {
  const q = new URLSearchParams(search);
  const text = (key: string, v: string, fallback: string) =>
    v === fallback ? q.delete(key) : q.set(key, v);
  text('view', state.view, URL_DEFAULTS.view);
  text('variant', state.variant, URL_DEFAULTS.variant);
  for (const k of Object.keys(NUMBERS) as (keyof typeof NUMBERS)[]) {
    text(NUMBERS[k], String(state[k]), String(URL_DEFAULTS[k]));
  }
  for (const k of Object.keys(FLAGS) as (keyof typeof FLAGS)[]) {
    if (state[k]) q.set(FLAGS[k], '');
    else q.delete(FLAGS[k]);
  }
  return q.toString().replace(/=(&|$)/g, '$1');
}
