// The split between the two entry points is the reason this package has a
// `nav-wright/benchy` subpath at all: `nav-wright` must stay loadable
// without three.js installed, since three, @react-three/fiber and
// @react-three/drei are optional peer dependencies.
//
// Nothing about a stray `import * as THREE` in a shared module would fail
// a typecheck, a test or a build — three.js is a devDependency here, so it
// always resolves in this repo. It would only surface as a bare
// ERR_MODULE_NOT_FOUND in a consumer who never asked for the 3D view. So
// the graph gets walked.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

const THREE_D_ONLY = ['three', '@react-three/fiber', '@react-three/drei'];

/** Every bare specifier reachable from `entry` by *static* imports, and
 * the module each was reached through. A dynamic `import()` is
 * deliberately not followed: deferring three.js behind one is exactly how
 * BenchyView and preloadBenchyModel keep it out of their own chunk. */
function staticImports(entry: string): Map<string, string> {
  const found = new Map<string, string>();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    // Static `import ... from '<spec>'` and `export ... from '<spec>'`,
    // which is what a bundler and Node both follow eagerly. The leading
    // \b keeps this off the `import(` in a dynamic import.
    const pattern = /\b(?:import|export)\b[^'"();]*?from\s*['"]([^'"]+)['"]/g;
    for (const [, spec] of source.matchAll(pattern)) {
      if (!spec.startsWith('.')) {
        if (!found.has(spec)) found.set(spec, file);
        continue;
      }
      // Sources are written with the .js suffix that nodenext enforces on
      // the emitted ESM; on disk they are .ts/.tsx.
      const base = resolve(dirname(file), spec).replace(/\.js$/, '');
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        try {
          readFileSync(candidate);
          queue.push(candidate);
          break;
        } catch {
          // the other extension
        }
      }
    }
  }
  return found;
}

describe('entry points', () => {
  it('reaches no 3D dependency from the SVG entry', () => {
    const imports = staticImports(resolve(SRC, 'index.ts'));
    const leaked = THREE_D_ONLY.filter((dep) => imports.has(dep)).map(
      (dep) => `${dep} (via ${imports.get(dep)})`,
    );
    expect(leaked).toEqual([]);
  });

  it('reaches no 3D dependency from the benchy entry either, since the '
    + 'canvas loads behind a dynamic import', () => {
    const imports = staticImports(resolve(SRC, 'benchy.ts'));
    const leaked = THREE_D_ONLY.filter((dep) => imports.has(dep)).map(
      (dep) => `${dep} (via ${imports.get(dep)})`,
    );
    expect(leaked).toEqual([]);
  });

  it('actually resolves the modules it walks', () => {
    // Guards the walker itself: a typo in the resolution above would make
    // both assertions above vacuously true.
    const imports = staticImports(resolve(SRC, 'benchy.ts'));
    expect(imports.has('react')).toBe(true);
  });

  it('finds the 3D dependencies from the canvas module', () => {
    // The other half of that guard: they are genuinely detectable, so the
    // assertions above are about where they are, not whether the walk
    // works.
    const imports = staticImports(resolve(SRC, 'BenchyModel.tsx'));
    for (const dep of THREE_D_ONLY) expect(imports.has(dep)).toBe(true);
  });
});
