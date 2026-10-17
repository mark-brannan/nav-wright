// The exported manifest of traced vessels names a shipped mesh for each one.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tracedVessels } from '../src/index.js';

describe('tracedVessels', () => {
  it('lists the traced vessels', () => expect(tracedVessels.length).toBeGreaterThanOrEqual(7));
  it.each(tracedVessels.map((v) => [v.id, v.model]))('%s ships %s', (_id, model) =>
    expect(existsSync(`models/${model}`)).toBe(true),
  );
});
