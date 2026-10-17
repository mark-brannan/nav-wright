import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeUrlState, encodeUrlState } from '../playground/urlState.js';

// The playground's own choices (main.tsx VIEWS and VARIANTS); main.tsx runs on
// import, so they are restated here.
const options = {
  views: ['3d', 'silhouette', 'profile', 'bearing'],
  variants: ['all', 'mesh', 'block', 'soft'],
};
// Keys urlState.ts owns, plus the two it leaves alone.
const KEYS = new Set([
  'view',
  'variant',
  'theta',
  'tilt',
  'hint',
  'range',
  'sky',
  'sea',
  'day',
  'lantern',
  'glow',
  'flash',
  'yaw',
  'compare',
]);
const NUMBERS = {
  theta: 'theta',
  tilt: 'tilt',
  hullHint: 'hint',
  range: 'range',
  sky: 'sky',
  sea: 'sea',
} as const;

interface Scene {
  name: string;
  url: string;
  description: string;
}
const list = JSON.parse(
  readFileSync(new URL('../playground/namedScenes.json', import.meta.url), 'utf8'),
) as { base: string; scenes: Scene[] };

describe('named playground scenes', () => {
  it('holds 8 to 12 scenes with unique names and one-line descriptions', () => {
    expect(list.scenes.length).toBeGreaterThanOrEqual(8);
    expect(list.scenes.length).toBeLessThanOrEqual(12);
    expect(new Set(list.scenes.map((s) => s.name)).size).toBe(list.scenes.length);
    for (const s of list.scenes) {
      expect(s.description.trim()).not.toBe('');
      expect(s.description).not.toContain('\n');
    }
  });

  it.each(list.scenes.map((s) => [s.name, s] as const))(
    '%s parses back to valid state',
    (_n, s) => {
      const url = new URL(s.url);
      expect(url.origin + url.pathname).toBe(list.base);
      const q = url.searchParams;
      for (const key of q.keys()) expect(KEYS.has(key), `unknown key ${key}`).toBe(true);
      const state = decodeUrlState(url.search, options);
      // nothing was clamped or dropped on the way in
      if (q.has('view')) expect(state.view).toBe(q.get('view'));
      if (q.has('variant')) expect(state.variant).toBe(q.get('variant'));
      for (const [field, key] of Object.entries(NUMBERS)) {
        if (q.has(key)) expect(state[field as keyof typeof NUMBERS], key).toBe(Number(q.get(key)));
      }
      // and it survives a write and a read
      expect(decodeUrlState(encodeUrlState(state), options)).toEqual(state);
    },
  );
});
