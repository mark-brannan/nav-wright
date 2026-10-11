// Every hull ships a lofted mesh (scripts/loft-hulls.mjs, MODELS.md), so a
// consumer can resolve `nav-wright/models/<id>-loft.glb` for any hull id.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allHulls } from '../src/hulls.js';

describe('lofted hull meshes', () => {
  for (const hull of Object.values(allHulls)) {
    it(`${hull.spec.id} has a glTF binary in models/`, () => {
      const bytes = readFileSync(new URL(`../models/${hull.spec.id}-loft.glb`, import.meta.url));
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    });
  }
});
