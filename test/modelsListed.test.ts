// nav-wright#44: every GLB in models/ is documented in MODELS.md by its full
// file name, and the package exports the directory.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = readdirSync('models').filter((f) => f.endsWith('.glb'));
const doc = readFileSync('MODELS.md', 'utf8');

describe('shipped meshes', () => {
  it('has meshes', () => expect(files.length).toBeGreaterThan(0));
  it.each(files)('%s is in MODELS.md', (f) => expect(doc).toContain(f));
  it('exports ./models/*', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.exports['./models/*']).toBe('./models/*');
    expect(pkg.files).toContain('models');
  });
});
