// Mesh -> 2D: an orthographic projection of a placed hull's triangles onto
// a view plane, nearest surface wins, traced back out as closed polygons per
// paint (docs/design/mesh-catalog.md: 2D views are projections of the mesh).
// Pure arithmetic over flat xyz triangles in the world placeScene() puts a
// mesh in: bow on +X, up on +Y, starboard on +Z, waterline at y = 0.
//
// A z-buffer raster, not exact polygon clipping: the view is sampled at
// pixel centres, each pixel keeps the paint of the nearest triangle, and
// each paint's pixels are traced along their edges and simplified. Detail
// finer than a pixel is lost, which is what a drawing at that scale shows.

/**
 * What the viewer looks from. `profile` stands abeam-or-anywhere on the
 * water: `bearing` is the viewer's relative bearing from the vessel in
 * degrees, clockwise from the bow, so 90 (the default) is from starboard
 * with the bow on the right, and 270 from port with the bow on the left.
 * `plan` looks straight down with the bow up and starboard on the right.
 */
export type MeshView = { kind: 'profile'; bearing?: number } | { kind: 'plan' };

/** A closed polygon in view-plane units: u to the viewer's right, v up. */
export type Loop = [number, number][];

export interface Projection {
  /** The view plane's extent of the projected mesh. */
  bounds: { u: [number, number]; v: [number, number] };
  /** The raster's pixel size, in the input's units. */
  pixel: number;
  /** The whole silhouette. */
  outline: Loop[];
  /** Where each paint is the nearest surface, in first-seen paint order. */
  layers: { paint: number; loops: Loop[] }[];
}

export interface ProjectionOptions {
  /** Raster pixels per input unit. Default 800: 1600 across a hull placed at length 2. */
  pixelsPerUnit?: number;
  /** Cap on the raster's longer side, which lowers `pixelsPerUnit` to fit. Default 2400. */
  maxPixels?: number;
  /** How far a simplified edge may stray from the pixel boundary, in pixels. Default 1.25: a
   * one-pixel staircase collapses to its slope. */
  tolerance?: number;
  /** Loops enclosing less than this many square pixels are dropped. Default 2. */
  minArea?: number;
}

type V3 = [number, number, number];

/** The view plane's right, up and toward-the-viewer axes in the placed world. */
export function viewAxes(view: MeshView): { right: V3; up: V3; toward: V3 } {
  if (view.kind === 'plan') return { right: [0, 0, 1], up: [1, 0, 0], toward: [0, 1, 0] };
  const b = (((view.bearing ?? 90) % 360) * Math.PI) / 180;
  const [c, s] = [Math.cos(b), Math.sin(b)];
  return { right: [s, 0, -c], up: [0, 1, 0], toward: [c, 0, s] };
}

/**
 * Project non-indexed triangles (`xyz`, nine numbers per triangle) with one
 * `paint` per triangle. Triangles seen edge-on cover nothing; a mesh that
 * covers nothing projects to empty bounds and no loops.
 */
export function projectTriangles(
  xyz: ArrayLike<number>,
  paint: ArrayLike<number>,
  view: MeshView,
  options: ProjectionOptions = {},
): Projection {
  const { right, up, toward } = viewAxes(view);
  const n = Math.floor(xyz.length / 9);
  if (paint.length !== n) throw new Error(`${n} triangles but ${paint.length} paints`);
  const dot = (a: V3, i: number) => a[0] * xyz[i] + a[1] * xyz[i + 1] + a[2] * xyz[i + 2];

  const pu = new Float64Array(n * 3);
  const pv = new Float64Array(n * 3);
  const pd = new Float64Array(n * 3);
  let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let k = 0; k < n * 3; k++) {
    pu[k] = dot(right, k * 3);
    pv[k] = dot(up, k * 3);
    pd[k] = dot(toward, k * 3);
    u0 = Math.min(u0, pu[k]);
    u1 = Math.max(u1, pu[k]);
    v0 = Math.min(v0, pv[k]);
    v1 = Math.max(v1, pv[k]);
  }
  if (!(u1 >= u0 && v1 >= v0)) return { bounds: { u: [0, 0], v: [0, 0] }, pixel: 0, outline: [], layers: [] };

  const longest = Math.max(u1 - u0, v1 - v0) || 1;
  const s = Math.min(options.pixelsPerUnit ?? 800, (options.maxPixels ?? 2400) / longest);
  // One empty pixel of margin all round, so every traced loop closes inside the grid.
  const ou = u0 - 1 / s;
  const ov = v0 - 1 / s;
  const W = Math.ceil((u1 - u0) * s) + 2;
  const H = Math.ceil((v1 - v0) * s) + 2;
  const depth = new Float64Array(W * H).fill(-Infinity);
  const owner = new Int32Array(W * H).fill(-1);

  for (let t = 0; t < n; t++) {
    const a = t * 3;
    const x0 = (pu[a] - ou) * s, y0 = (pv[a] - ov) * s;
    const x1 = (pu[a + 1] - ou) * s, y1 = (pv[a + 1] - ov) * s;
    const x2 = (pu[a + 2] - ou) * s, y2 = (pv[a + 2] - ov) * s;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-12) continue;
    const iMin = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5));
    const iMax = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) - 0.5));
    const jMin = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5));
    const jMax = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) - 0.5));
    for (let j = jMin; j <= jMax; j++) {
      const py = j + 0.5;
      for (let i = iMin; i <= iMax; i++) {
        const px = i + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const d = w0 * pd[a] + w1 * pd[a + 1] + w2 * pd[a + 2];
        const at = j * W + i;
        if (d > depth[at]) {
          depth[at] = d;
          owner[at] = t;
        }
      }
    }
  }

  const tol = options.tolerance ?? 1.25;
  const minArea = options.minArea ?? 2;
  const toUnits = (loop: Loop): Loop => loop.map(([x, y]) => [ou + x / s, ov + y / s]);
  const trace = (inside: (at: number) => boolean) =>
    traceMask(W, H, inside)
      .map((l) => simplifyLoop(l, tol))
      .filter((l) => Math.abs(loopArea(l)) >= minArea)
      .map(toUnits);

  const painted = new Int32Array(W * H).fill(-1);
  const paints: number[] = [];
  for (let at = 0; at < W * H; at++) {
    if (owner[at] < 0) continue;
    const p = paint[owner[at]];
    painted[at] = p;
    if (!paints.includes(p)) paints.push(p);
  }
  return {
    bounds: { u: [u0, u1], v: [v0, v1] },
    pixel: 1 / s,
    outline: trace((at) => painted[at] !== -1),
    layers: paints
      .map((p) => ({ paint: p, loops: trace((at) => painted[at] === p) }))
      .filter((l) => l.loops.length > 0),
  };
}

/** `loops` as one SVG path, v flipped onto SVG's downward y. Fill it even-odd. */
export function loopsPath(loops: Loop[], digits = 3): string {
  const f = (x: number) => {
    const r = Number(x.toFixed(digits));
    return String(r === 0 ? 0 : r);
  };
  return loops
    .map((l) => l.map(([u, v], i) => `${i ? 'L' : 'M'}${f(u)} ${f(-v)}`).join('') + 'Z')
    .join('');
}

/** Signed area, positive counter-clockwise with v up. */
export function loopArea(loop: Loop): number {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i];
    const [x1, y1] = loop[(i + 1) % loop.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

// Directions on the pixel lattice: +x, +y, -x, -y.
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** Every boundary of the pixels `inside` marks, as closed loops of lattice
 * corners with the inside on the left (outer boundaries counter-clockwise,
 * holes clockwise). Pixels touching only at a corner trace apart. */
function traceMask(W: number, H: number, inside: (at: number) => boolean): Loop[] {
  const isIn = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && inside(j * W + i);
  const key = (i: number, j: number) => j * (W + 1) + i;
  const startI: number[] = [];
  const startJ: number[] = [];
  const dir: number[] = [];
  const out = new Map<number, number[]>();
  const edge = (i: number, j: number, d: number) => {
    const e = dir.length;
    startI.push(i);
    startJ.push(j);
    dir.push(d);
    const k = key(i, j);
    const list = out.get(k);
    if (list) list.push(e);
    else out.set(k, [e]);
  };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (!inside(j * W + i)) continue;
      if (!isIn(i, j - 1)) edge(i, j, 0);
      if (!isIn(i + 1, j)) edge(i + 1, j, 1);
      if (!isIn(i, j + 1)) edge(i + 1, j + 1, 2);
      if (!isIn(i - 1, j)) edge(i, j + 1, 3);
    }

  const used = new Uint8Array(dir.length);
  const loops: Loop[] = [];
  for (let first = 0; first < dir.length; first++) {
    if (used[first]) continue;
    const loop: Loop = [];
    const loopEdges: number[] = [];
    let e = first;
    while (e >= 0 && !used[e]) {
      used[e] = 1;
      const d = dir[e];
      // Keep only corners: a straight run adds no point.
      const prev = loop.length ? dir[loopEdges[loopEdges.length - 1]] : -1;
      if (d !== prev) loop.push([startI[e], startJ[e]]);
      loopEdges.push(e);
      const next = (out.get(key(startI[e] + DX[d], startJ[e] + DY[d])) ?? []).filter((x) => !used[x]);
      e =
        next.find((x) => dir[x] === (d + 1) % 4) ??
        next.find((x) => dir[x] === d) ??
        next[0] ??
        -1;
    }
    // The first point is a corner only if the run into it turns.
    if (loop.length > 1 && dir[loopEdges[loopEdges.length - 1]] === dir[loopEdges[0]]) loop.shift();
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Douglas-Peucker on a closed loop, split at the corner farthest from its first. */
function simplifyLoop(loop: Loop, tol: number): Loop {
  if (loop.length <= 4) return loop;
  let far = 0;
  let best = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i][0] - loop[0][0]) ** 2 + (loop[i][1] - loop[0][1]) ** 2;
    if (d > best) [best, far] = [d, i];
  }
  const closed = [...loop, loop[0]];
  const keep = new Uint8Array(closed.length);
  keep[0] = keep[far] = keep[closed.length - 1] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, closed.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = closed[a];
    const [bx, by] = closed[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - closed[i][1]) - (ax - closed[i][0]) * (by - ay)) / len;
      if (d > worst) [worst, at] = [d, i];
    }
    if (worst > tol) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return closed.slice(0, -1).filter((_, i) => keep[i]);
}
