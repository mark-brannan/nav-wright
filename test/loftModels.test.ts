// Every hull ships a lofted mesh (scripts/loft-hulls.mjs, MODELS.md), so a
// consumer can resolve `nav-wright/models/loft-<id>.glb` for any hull id.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allHulls } from '../src/hulls.js';

describe('lofted hull meshes', () => {
  for (const hull of Object.values(allHulls)) {
    it(`${hull.spec.id} has a glTF binary in models/`, () => {
      const bytes = readFileSync(new URL(`../models/loft-${hull.spec.id}.glb`, import.meta.url));
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    });
    for (const v of ['slender', 'sheered', 'highside'])
      it(`${hull.spec.id} has a ${v} variant`, () => {
        const f = new URL(`../models/loft-${hull.spec.id}-${v}.glb`, import.meta.url);
        const bytes = readFileSync(f);
        expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
        expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      });
  }
});

// Every traced sailing vessel (docs/research/sailboat-lines/<id>.json) ships
// its own loft, models/<id>.glb, afloat on the waterline it names.
describe('traced sailing-vessel meshes', () => {
  const dir = new URL('../docs/research/sailboat-lines/', import.meta.url);
  const ids = readdirSync(dir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => n.slice(0, -5));
  it('has traces', () => expect(ids.length).toBeGreaterThan(0));
  for (const id of ids)
    it(`${id} has a glTF binary with a waterline in models/`, () => {
      const bytes = readFileSync(new URL(`../models/${id}.glb`, import.meta.url));
      expect(bytes.toString('ascii', 0, 4)).toBe('glTF');
      expect(bytes.readUInt32LE(8)).toBe(bytes.length);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      expect(json.nodes[0].extras.waterlineZ).toBe(0);
      expect(json.nodes[0].extras.hullX).toEqual([-1, 1]);
      const extents = json.accessors.filter((a: { min?: number[] }) => a.min);
      expect(Math.min(...extents.map((a: { min: number[] }) => a.min[2]))).toBeLessThan(0);
      expect(Math.max(...extents.map((a: { max: number[] }) => a.max[2]))).toBeGreaterThan(0);
    });
});
