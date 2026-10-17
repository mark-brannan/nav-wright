// The mesh catalog (docs/design/mesh-catalog.md): every shipped .glb has a
// sidecar and a record, every record a mesh, the records validate, the
// generated outputs are current with the sidecars, and the traced meshes
// measure as their traces say.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { meshCatalog, meshRecordSchema, meshSidecarSchema } from '../src/index.js';

const FT = 0.3048;
const glbs = readdirSync('models')
  .filter((f) => f.endsWith('.glb'))
  .sort();
const sidecars = readdirSync('models')
  .filter((f) => f.endsWith('.json') && !['catalog.json', 'mesh-record.schema.json'].includes(f))
  .sort();
const json = JSON.parse(readFileSync('models/catalog.json', 'utf8')) as unknown[];

describe('mesh catalog', () => {
  it('has a record for every mesh and a mesh for every record', () => {
    expect(meshCatalog.map((r) => r.file)).toEqual(glbs);
    expect(sidecars.map((f) => f.replace(/\.json$/, '.glb'))).toEqual(glbs);
  });
  it('ships the same records as JSON', () => expect(json).toEqual(meshCatalog));
  it.each(meshCatalog.map((r) => [r.file, r] as const))('%s validates', (_f, r) => {
    expect(meshRecordSchema.safeParse(r).success).toBe(true);
  });
  it.each(sidecars)('%s is folded into the catalog as written', (f) => {
    const sidecar = meshSidecarSchema.parse(JSON.parse(readFileSync(`models/${f}`, 'utf8')));
    const record = meshCatalog.find((r) => r.file === sidecar.file)!;
    expect(record).toMatchObject(sidecar);
    expect(
      Object.keys(record)
        .filter((k) => !(k in sidecar))
        .sort(),
    ).toEqual(['frame', 'lights', 'proportions']);
  });
  it('is in package.json files', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.files).toContain('models');
    expect(pkg.files).toContain('dist');
  });
});

describe('traced meshes measure as their traces say', () => {
  const traced = meshCatalog.filter((r) => r.kind === 'traced');
  it('covers every trace', () =>
    expect(traced.map((r) => r.source.trace).sort()).toEqual(
      readdirSync('docs/research/sailboat-lines')
        .filter((f) => f.endsWith('.json'))
        .map((f) => `docs/research/sailboat-lines/${f}`)
        .sort(),
    ));
  it.each(traced.map((r) => [r.file, r] as const))('%s', (_f, r) => {
    const { specs } = JSON.parse(readFileSync(r.source.trace!, 'utf8')) as {
      specs: { loaFt: number; beamFt: number; draftFt: number };
    };
    expect(r.nominal).toBe(false);
    expect(r.loaM).toBeCloseTo(specs.loaFt * FT, 2);
    expect(r.beamM).toBeCloseTo(specs.beamFt * FT, 2);
    expect(r.draftM).toBeCloseTo(specs.draftFt * FT, 2);
    // The mesh's beam is the hull's widest station; the spec's is the
    // designer's figure. Within a tenth.
    const specLB = specs.loaFt / specs.beamFt;
    expect(Math.abs(r.proportions.lengthBeam - specLB) / specLB).toBeLessThan(0.1);
    expect(r.frame).toEqual({ waterlineZ: 0, hullX: [-1, 1] });
    // Sails: the rig stands taller than the deck.
    expect(r.lights.masthead[1]).toBeGreaterThan(r.lights.sidelight[1]);
  });
});
