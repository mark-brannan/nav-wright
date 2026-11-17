// Mesh -> 2D projection (nav-wright#150): which way each view faces, that
// the nearest surface wins, and that every shipped mesh's drawings span what
// the catalog measured off the same mesh.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { meshCatalog } from '../src/index.js';
import { loopArea, loopsPath, projectTriangles } from '../src/meshProjection.js';
import type { Projection } from '../src/meshProjection.js';

/** A box's twelve triangles, x fore-aft, y up, z starboard. */
function box([x0, x1]: number[], [y0, y1]: number[], [z0, z1]: number[]): number[] {
  const c = (i: number) => [i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0];
  const quads = [
    [0, 1, 3, 2],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 3, 7, 5],
  ];
  return quads.flatMap(([a, b, d, e]) => [a, b, d, a, d, e].flatMap(c));
}

function scene(...parts: number[][]) {
  return {
    xyz: parts.flat(),
    paint: parts.flatMap((p, i) => Array(p.length / 9).fill(i)),
  };
}

const area = (p: Projection, paint?: number) =>
  (paint === undefined ? p.outline : p.layers.find((l) => l.paint === paint)!.loops).reduce(
    (a, l) => a + loopArea(l),
    0,
  );

/** Hull 0 and a tall mast 1 near the bow, on the starboard half. */
const marked = scene(box([-1, 1], [0, 0.2], [-0.3, 0.3]), box([0.7, 0.8], [0.2, 1], [0.05, 0.25]));

describe('projectTriangles', () => {
  it('profile from starboard puts the bow on the right, up on top', () => {
    const p = projectTriangles(marked.xyz, marked.paint, { kind: 'profile' });
    expect(p.bounds.u).toEqual([-1, 1]);
    expect(p.bounds.v).toEqual([0, 1]);
    const mast = p.layers.find((l) => l.paint === 1)!.loops.flat();
    expect(Math.min(...mast.map(([u]) => u))).toBeCloseTo(0.7, 2);
    expect(Math.min(...mast.map(([, v]) => v))).toBeCloseTo(0.2, 2);
  });

  it('profile from port puts the bow on the left', () => {
    const p = projectTriangles(marked.xyz, marked.paint, { kind: 'profile', bearing: 270 });
    const mast = p.layers.find((l) => l.paint === 1)!.loops.flat();
    expect(Math.max(...mast.map(([u]) => u))).toBeCloseTo(-0.7, 2);
  });

  it('plan puts the bow up and starboard on the right', () => {
    const p = projectTriangles(marked.xyz, marked.paint, { kind: 'plan' });
    expect(p.bounds.u).toEqual([-0.3, 0.3]);
    expect(p.bounds.v).toEqual([-1, 1]);
    const mast = p.layers.find((l) => l.paint === 1)!.loops.flat();
    expect(Math.min(...mast.map(([u]) => u))).toBeCloseTo(0.05, 2);
    expect(Math.min(...mast.map(([, v]) => v))).toBeCloseTo(0.7, 2);
    expect(area(p, 1)).toBeCloseTo(0.1 * 0.2, 3);
  });

  it('paints each pixel with the nearest surface', () => {
    // Two overlapping plates; the starboard one hides part of the port one.
    const far = box([-1, 0.5], [0, 1], [-0.3, -0.2]);
    const near = box([0, 1], [0, 1], [0.2, 0.3]);
    const s = scene(far, near);
    const stbd = projectTriangles(s.xyz, s.paint, { kind: 'profile', bearing: 90 });
    expect(area(stbd, 1)).toBeCloseTo(1, 2);
    expect(area(stbd, 0)).toBeCloseTo(1, 2);
    const port = projectTriangles(s.xyz, s.paint, { kind: 'profile', bearing: 270 });
    expect(area(port, 0)).toBeCloseTo(1.5, 2);
    expect(area(port, 1)).toBeCloseTo(0.5, 2);
    expect(area(stbd)).toBeCloseTo(2, 2);
  });

  it('traces a hole as its own loop, wound against the outline', () => {
    const ring = scene(
      box([-1, 1], [0.5, 1], [0, 0.1]),
      box([-1, 1], [-1, -0.5], [0, 0.1]),
      box([-1, -0.5], [-0.5, 0.5], [0, 0.1]),
      box([0.5, 1], [-0.5, 0.5], [0, 0.1]),
    );
    const p = projectTriangles(ring.xyz, ring.paint, { kind: 'profile' });
    expect(p.outline).toHaveLength(2);
    expect(p.outline.map((l) => Math.sign(loopArea(l))).sort()).toEqual([-1, 1]);
    expect(area(p)).toBeCloseTo(4 - 1, 2);
  });

  it('keeps an edge-on face out of the drawing', () => {
    const sheet = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const p = projectTriangles(sheet, [0], { kind: 'profile', bearing: 0 });
    expect(p.outline).toEqual([]);
  });

  it('writes SVG paths with y down', () => {
    expect(loopsPath([[[0, 0], [1, 0], [1, 0.5]]])).toBe('M0 0L1 0L1 -0.5Z');
  });
});

/** The bounds a drawing was projected over, read off its root element. */
function svgBounds(file: string): { u: number[]; v: number[] } {
  const svg = readFileSync(`models/${file}`, 'utf8');
  const num = (name: string) => svg.match(new RegExp(`data-${name}="([^"]+)"`))![1].split(' ').map(Number);
  return { u: num('u'), v: num('v') };
}

describe('shipped projections', () => {
  const stems = readdirSync('models')
    .filter((f) => f.endsWith('.glb'))
    .map((f) => f.slice(0, -4));
  const svgs = readdirSync('models').filter((f) => f.endsWith('.svg'));

  it('draws a profile and a plan for every mesh and nothing else', () => {
    expect(svgs.sort()).toEqual(stems.flatMap((s) => [`${s}-plan.svg`, `${s}-profile.svg`]).sort());
  });

  it.each(meshCatalog.map((r) => [r.file, r] as const))(
    '%s: plan width is her beam and profile height her freeboard to the truck, as catalogued',
    (file, r) => {
      const stem = file.slice(0, -4);
      // Both views place the hull at length 2, so the catalog's ratios turn into spans.
      const plan = svgBounds(`${stem}-plan.svg`);
      expect(plan.u[1] - plan.u[0]).toBeCloseTo(2 / r.proportions.lengthBeam, 2);
      // Her hull spans [-1, 1] fore and aft; spars may reach past it.
      expect(plan.v[0]).toBeLessThan(-0.995);
      expect(plan.v[1]).toBeGreaterThan(0.995);
      const profile = svgBounds(`${stem}-profile.svg`);
      expect(profile.v[1]).toBeCloseTo(2 / r.proportions.lengthHeight, 2);
      expect(profile.u).toEqual(plan.v);
    },
  );
});
