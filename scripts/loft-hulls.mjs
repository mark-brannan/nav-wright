// Lofts a 3D mesh for every hull in allHulls from its own 2D drawings and
// writes it to models/loft-<id>.glb, with its catalog sidecar
// models/loft-<id>.json beside it (nav-wright#44: "loft a custom
// BufferGeometry between stations" for any hull without a sourced mesh).
//
// The side profile gives each part's keel and deck line at every station;
// the plan outline gives the half-beam there. Every filled shape in the
// profile becomes a solid: the lowest one is the hull, lofted through
// rounded sections, and the rest are deckhouses, lofted as boxes a little
// narrower than the hull under them. Rig lines become thin spars on the
// centreline.
//
// The output follows the Benchy convention BenchyView relies on (see
// MODELS.md): Z up, bow on +X, half-length units, so a mesh drops into the
// same placeHullModel path with no extra transform. Heights are scaled by
// the profile's own aspect (LIGHT_Z_TO_X), so a deck sits where the 2D
// profile and the analytic lights put it.
//
//   npm run build && node scripts/loft-hulls.mjs
//
// Deterministic: the same drawings write byte-identical files.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allHulls } from '../dist/index.js';
import { LIGHT_Z_TO_X } from '../dist/modelTransform.js';
import { glb } from './glb.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'models');

/** Stations along each lofted part, and points around each hull section. */
const STATIONS = 40;
const SECTION = 14;
/** Deckhouse width as a fraction of the hull's half-beam at that station. */
const HOUSE_BEAM = 0.82;
/** Spar thickness, half-length units. */
const SPAR = 0.012;

/** Loft variants (nav-wright#44: several meshes per hull class, from
 * parameters). Every parameter is a multiplier on the drawing, so `base` is
 * the drawing itself and its files do not change.
 *   beam         hull half-beam
 *   sheer        deck line lifted at bow and stern, as a fraction of the
 *                hull's height, rising with the square of the distance from
 *                midships
 *   freeboard    height of the deck above the waterline
 *   house        height of each deckhouse above its own floor
 *   houseBeam    deckhouse width, against the 0.82 of the base loft
 * `base` writes models/loft-<id>.glb; the others
 * models/loft-<id>-<name>.glb. */
const VARIANTS = {
  base: { beam: 1, sheer: 0, freeboard: 1, house: 1, houseBeam: 1 },
  slender: { beam: 0.8, sheer: 0.06, freeboard: 0.92, house: 0.9, houseBeam: 1.05 },
  sheered: { beam: 1.05, sheer: 0.22, freeboard: 1, house: 1, houseBeam: 0.95 },
  highside: { beam: 1.15, sheer: 0.08, freeboard: 1.25, house: 1.3, houseBeam: 0.85 },
};

/** Per-hull additions to every non-base variant, for hulls whose drawing
 * cannot pass hullMeshCheck by scaling alone (the base loft is unchanged).
 *   bowTaper     the half-beam closes by this fraction over the forward 30%
 *                of the hull: a barge's square end gets a raked bow
 *   houseSpan    each deckhouse's length scaled about its centre: a barge's
 *                cargo mound becomes a heap, not the whole deck
 *   console      a box on an open boat's centreline, so it has a rail line:
 *                [from, to] as fractions of length, height as a fraction of
 *                the hull's height */
const EXTRAS = {
  barge: { bowTaper: 0.7, houseSpan: 0.5 },
  open: { console: { from: 0.45, to: 0.6, height: 0.5 } },
};

const COLOURS = {
  hull: [0.16, 0.23, 0.32],
  house: [0.86, 0.87, 0.85],
  rig: [0.55, 0.57, 0.6],
};

// --- reading the drawings ------------------------------------------------

/** SVG profile pixels back to (fx, z): the inverse of hulls.tsx's PX/PZ. */
const fx = (px) => (px - 220) / 185;
const fz = (py) => (185 - py) / 150;

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/** The vertices of an SVG path, absolute, in profile pixels. Curves keep
 * only their end points: the drawings are polygons with the odd flourish. */
function pathPoints(d) {
  const pts = [];
  let x = 0;
  let y = 0;
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let cmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  const arity = { m: 2, l: 2, h: 1, v: 1, q: 4, t: 2, c: 6, s: 4, a: 7, z: 0 };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const c = cmd.toLowerCase();
    if (c === 'z') continue;
    const rel = cmd !== cmd.toUpperCase();
    const args = Array.from({ length: arity[c] }, num);
    if (c === 'h') x = rel ? x + args[0] : args[0];
    else if (c === 'v') y = rel ? y + args[0] : args[0];
    else {
      const [ex, ey] = args.slice(-2);
      x = rel ? x + ex : ex;
      y = rel ? y + ey : ey;
    }
    pts.push([fx(x), fz(y)]);
    if (c === 'm') cmd = rel ? 'l' : 'L';
  }
  return pts;
}

function readProfile(Profile) {
  const svg = renderToStaticMarkup(createElement(Profile));
  const solids = [];
  const spars = [];
  for (const m of svg.matchAll(/<(path|line)\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (m[1] === 'line') {
      if (a.stroke === 'var(--rig-stroke)')
        spars.push([
          [fx(+a.x1), fz(+a.y1)],
          [fx(+a.x2), fz(+a.y2)],
        ]);
      continue;
    }
    const pts = pathPoints(a.d ?? '');
    if (a.fill === 'var(--hull-fill)' && pts.length >= 3) solids.push(pts);
    else if (a.stroke === 'var(--rig-stroke)')
      for (let k = 1; k < pts.length; k++) spars.push([pts[k - 1], pts[k]]);
  }
  return { solids, spars };
}

// --- polygon queries -----------------------------------------------------

/** Where the vertical line at x crosses a closed polygon: [low, high], or
 * null when it misses. */
function extentAt(poly, x) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < poly.length; k++) {
    const [x1, y1] = poly[k];
    const [x2, y2] = poly[(k + 1) % poly.length];
    if (x < Math.min(x1, x2) || x > Math.max(x1, x2)) continue;
    const y = x1 === x2 ? Math.max(y1, y2) : y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
    const yl = x1 === x2 ? Math.min(y1, y2) : y;
    lo = Math.min(lo, yl);
    hi = Math.max(hi, y);
  }
  return lo <= hi ? [lo, hi] : null;
}

const xRange = (poly) => [Math.min(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[0]))];

// --- building ------------------------------------------------------------

class Part {
  constructor() {
    this.pos = [];
  }
  tri(a, b, c) {
    this.pos.push(...a, ...b, ...c);
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
}

/** Lofts one closed side-profile shape between stations. `section(s, lo,
 * hi, b)` gives the height at transverse fraction s in [-1, 1]; the first
 * and last points of every section are its deck edges. */
function loft(part, poly, beamAt, depth, shape = (_x, lo, hi) => [lo, hi]) {
  const [x0, x1] = xRange(poly);
  const rings = [];
  for (let i = 0; i <= STATIONS; i++) {
    const x = x0 + ((x1 - x0) * i) / STATIONS;
    const e = extentAt(poly, Math.min(Math.max(x, x0 + 1e-6), x1 - 1e-6));
    if (!e) continue;
    const [lo, hi] = shape(x, ...e.map((z) => z * LIGHT_Z_TO_X));
    const b = Math.max(beamAt(x), 0.002);
    const ring = [];
    for (let j = 0; j <= SECTION; j++) {
      const s = -1 + (2 * j) / SECTION;
      ring.push([x, b * s, depth(s, lo, hi)]);
    }
    rings.push(ring);
  }
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1];
    const b = rings[i];
    for (let j = 1; j <= SECTION; j++) part.quad(a[j - 1], b[j - 1], b[j], a[j]);
    part.quad(a[SECTION], b[SECTION], b[0], a[0]); // deck
  }
  for (const [ring, flip] of [
    [rings[0], false],
    [rings.at(-1), true],
  ]) {
    if (!ring) continue;
    const c = ring
      .reduce((m, p) => [m[0] + p[0], m[1] + p[1], m[2] + p[2]], [0, 0, 0])
      .map((v) => v / ring.length);
    for (let j = 0; j < ring.length; j++) {
      const p = ring[j];
      const q = ring[(j + 1) % ring.length];
      flip ? part.tri(c, p, q) : part.tri(c, q, p);
    }
  }
}

function spar(part, [[ax, az], [bx, bz]], lift = () => 0) {
  const A = [ax, 0, az * LIGHT_Z_TO_X + lift(ax)];
  const B = [bx, 0, bz * LIGHT_Z_TO_X + lift(bx)];
  const len = Math.hypot(B[0] - A[0], B[2] - A[2]);
  if (len < 1e-6) return;
  // Normal to the spar in the XZ plane, and the athwartships axis.
  const n = [(-(B[2] - A[2]) / len) * SPAR, 0, ((B[0] - A[0]) / len) * SPAR];
  const w = [0, SPAR, 0];
  const corner = (P, sn, sw) => [P[0] + sn * n[0], P[1] + sw * w[1], P[2] + sn * n[2]];
  const ring = (P) => [corner(P, 1, 1), corner(P, -1, 1), corner(P, -1, -1), corner(P, 1, -1)];
  const ra = ring(A);
  const rb = ring(B);
  for (let k = 0; k < 4; k++) part.quad(ra[k], rb[k], rb[(k + 1) % 4], ra[(k + 1) % 4]);
  part.quad(ra[3], ra[2], ra[1], ra[0]);
  part.quad(rb[0], rb[1], rb[2], rb[3]);
}

function planBeamAt(plan) {
  return (x) => {
    const e = extentAt(plan, x);
    return e ? Math.max(Math.abs(e[0]), Math.abs(e[1])) : 0;
  };
}

function buildHull(hull, v = VARIANTS.base) {
  const { solids, spars } = readProfile(hull.Profile);
  const lowest = (p) => Math.min(...p.map((q) => q[1]));
  solids.sort((a, b) => lowest(a) - lowest(b));
  const [shell, ...houses] = solids;
  const beam0 = planBeamAt(hull.plan);
  const [x0, x1] = xRange(shell);
  const taper = (x) => {
    const t = (x - x0) / (x1 - x0);
    return 1 - (v.bowTaper ?? 0) * Math.max(0, (t - 0.7) / 0.3) ** 2;
  };
  const beam = (x) => beam0(x) * v.beam * taper(x);
  // Sail and small craft get round bilges; ships a fuller, boxier section.
  const fullness = hull.spec.beam < 0.21 ? 2 : 3.5;
  const height = Math.max(...shell.map((p) => p[1])) * LIGHT_Z_TO_X;
  // How far the hull's deck line moves from the drawing at x.
  const lift = (x) => {
    const e = extentAt(shell, Math.min(Math.max(x, x0 + 1e-6), x1 - 1e-6));
    if (!e) return 0;
    const u = (2 * (x - x0)) / (x1 - x0) - 1;
    const hi = e[1] * LIGHT_Z_TO_X;
    return hi * (v.freeboard - 1) + v.sheer * height * u * u;
  };
  const parts = { hull: new Part(), house: new Part(), rig: new Part() };
  loft(
    parts.hull,
    shell,
    beam,
    (s, lo, hi) => hi - (hi - lo) * (1 - Math.abs(s) ** fullness) ** (1 / fullness),
    (x, lo, hi) => [lo, hi + lift(x)],
  );
  if (v.console && houses.length === 0) {
    const a = x0 + (x1 - x0) * v.console.from;
    const b = x0 + (x1 - x0) * v.console.to;
    const floor = extentAt(shell, (a + b) / 2)[1];
    const top = floor + (v.console.height * height) / LIGHT_Z_TO_X;
    houses.push([
      [a, floor],
      [b, floor],
      [b, top],
      [a, top],
    ]);
  }
  if (v.houseSpan)
    for (let k = 0; k < houses.length; k++) {
      const [lo, hi] = xRange(houses[k]);
      houses[k] = houses[k].map(([x, z]) => [(lo + hi) / 2 + (x - (lo + hi) / 2) * v.houseSpan, z]);
    }
  // A deckhouse is a box: its sides stand straight from its own floor,
  // which rides up with the deck under it.
  for (const h of houses)
    loft(
      parts.house,
      h,
      (x) => beam(x) * HOUSE_BEAM * v.houseBeam,
      (s, lo, hi) => (Math.abs(s) === 1 ? hi : lo),
      (x, lo, hi) => [lo + lift(x), lo + lift(x) + (hi - lo) * v.house],
    );
  for (const s of spars) spar(parts.rig, s, lift);
  return parts;
}

/** The sidecar each loft ships beside its mesh (docs/design/mesh-catalog.md):
 * the nominal vessel the drawing depicts, at the length the old size band
 * put her. `loaM` is that band's length; `beamM` is the drawing's beam at
 * it; there is no underbody, so no draft. `fit` is the band a scene may
 * scale her to before the UI must say "scaled". */
const NOMINAL = {
  open: {
    name: 'Open boat',
    hullForm: 'open boat, no superstructure',
    propulsion: ['oars', 'power'],
    shows: ['open-cockpit'],
    loaM: 5,
    fit: [3, 7],
  },
  'power-small': {
    name: 'Small motor cruiser',
    hullForm: 'small planing motor cruiser, cabin forward',
    propulsion: ['power'],
    shows: ['cabin'],
    loaM: 12,
    fit: [7, 20],
    aisType: 37,
  },
  'power-large': {
    name: 'Motor yacht',
    hullForm: 'motor yacht, deckhouse and flybridge',
    propulsion: ['power'],
    shows: ['deckhouse'],
    loaM: 35,
    fit: [20, 50],
    aisType: 37,
  },
  'sail-small': {
    name: 'Sloop',
    hullForm: 'sailing yacht, single mast',
    rig: 'bermudan sloop',
    propulsion: ['sail', 'power'],
    shows: ['masts'],
    loaM: 12,
    fit: [5, 20],
    aisType: 36,
  },
  'sail-large': {
    name: 'Ketch',
    hullForm: 'sailing yacht, two masts',
    rig: 'ketch',
    propulsion: ['sail', 'power'],
    shows: ['masts'],
    loaM: 30,
    fit: [20, 40],
    aisType: 36,
  },
  'square-rigger': {
    name: 'Square-rigged ship',
    hullForm: 'square-rigged sailing ship, three masts with yards',
    rig: 'three-masted square rig',
    propulsion: ['sail'],
    shows: ['masts', 'yards', 'bowsprit'],
    loaM: 60,
    fit: [40, 120],
    aisType: 36,
  },
  trawler: {
    name: 'Stern trawler',
    hullForm: 'stern trawler, wheelhouse forward, gantry aft',
    propulsion: ['power'],
    shows: ['wheelhouse', 'gantry'],
    loaM: 30,
    fit: [15, 50],
    aisType: 30,
  },
  seiner: {
    name: 'Purse seiner',
    hullForm: 'purse seiner, wheelhouse forward, net drum and boom aft',
    propulsion: ['power'],
    shows: ['wheelhouse', 'boom'],
    loaM: 30,
    fit: [15, 50],
    aisType: 30,
  },
  tug: {
    name: 'Tug',
    hullForm: 'harbour tug, high bow, towing winch aft',
    propulsion: ['power'],
    shows: ['wheelhouse', 'funnel', 'towing-gear'],
    loaM: 30,
    fit: [15, 45],
    aisType: 52,
  },
  pusher: {
    name: 'Push tug',
    hullForm: 'push tug, square bow with push knees, wheelhouse raised on a pillar',
    propulsion: ['power'],
    shows: ['wheelhouse', 'push-knees'],
    loaM: 30,
    fit: [15, 45],
    aisType: 52,
  },
  barge: {
    name: 'Barge',
    hullForm: 'dumb barge, square ends, cargo mound',
    propulsion: ['none'],
    shows: ['cargo'],
    loaM: 40,
    fit: [20, 80],
  },
  'partly-submerged': {
    name: 'Dracone',
    hullForm: 'inconspicuous, partly submerged tow: a dracone or raft of logs, barely awash',
    propulsion: ['none'],
    shows: [],
    loaM: 40,
    fit: [20, 80],
  },
  'pilot-boat': {
    name: 'Pilot boat',
    hullForm: 'fine-lined fast pilot boat, wheelhouse amidships',
    propulsion: ['power'],
    shows: ['wheelhouse'],
    loaM: 18,
    fit: [12, 25],
    aisType: 50,
  },
  ferry: {
    name: 'Ferry',
    hullForm: 'passenger ferry, superstructure the length of the hull',
    propulsion: ['power'],
    shows: ['superstructure', 'funnel'],
    loaM: 90,
    fit: [50, 120],
    aisType: 60,
  },
  'container-ship': {
    name: 'Container ship',
    hullForm: 'container ship, bridge aft, boxes stacked on deck',
    propulsion: ['power'],
    shows: ['containers', 'bridge', 'funnel'],
    loaM: 250,
    fit: [120, 400],
    aisType: 70,
  },
  tanker: {
    name: 'Tanker',
    hullForm: 'full-bodied tanker, bridge aft, low pipework deck',
    propulsion: ['power'],
    shows: ['bridge', 'funnel'],
    loaM: 200,
    fit: [120, 350],
    aisType: 80,
  },
  bulker: {
    name: 'Bulk carrier',
    hullForm: 'full-bodied bulk carrier, bridge aft, hatch covers on deck',
    propulsion: ['power'],
    shows: ['bridge', 'funnel', 'hatches'],
    loaM: 200,
    fit: [120, 300],
    aisType: 70,
  },
  'cruise-ship': {
    name: 'Cruise ship',
    hullForm: 'cruise ship, superstructure the length of the hull, funnel aft',
    propulsion: ['power'],
    shows: ['superstructure', 'funnel'],
    loaM: 250,
    fit: [120, 350],
    aisType: 60,
  },
  warship: {
    name: 'Frigate',
    hullForm: 'fine-lined warship, bridge forward, mast and funnel amidships',
    propulsion: ['power'],
    shows: ['bridge', 'masts', 'funnel'],
    loaM: 100,
    fit: [60, 160],
    aisType: 35,
  },
  dredger: {
    name: 'Dredger',
    hullForm: 'pontoon-hulled dredger with a bow, crane amidships',
    propulsion: ['power'],
    shows: ['cranes'],
    loaM: 60,
    fit: [30, 100],
    aisType: 33,
  },
  'mine-clearance': {
    name: 'Minehunter',
    hullForm: 'mine countermeasures vessel, bridge forward, sweep gear aft',
    propulsion: ['power'],
    shows: ['bridge', 'masts', 'sweep-gear'],
    loaM: 50,
    fit: [35, 70],
    aisType: 35,
  },
  'fishing-gear': {
    name: 'Trawler, gear out',
    hullForm: 'trawler with a derrick boom up and the warp running astern',
    propulsion: ['power'],
    shows: ['wheelhouse', 'gantry', 'fishing-gear'],
    loaM: 30,
    fit: [15, 50],
    aisType: 30,
  },
  aground: {
    name: 'Coaster, aground',
    hullForm: 'small coaster, drawn trimmed by the stern with her forefoot up on a shoal',
    propulsion: ['power'],
    shows: ['bridge', 'funnel'],
    loaM: 60,
    fit: [30, 100],
    aisType: 70,
  },
  'dive-support': {
    name: 'Dive-support vessel',
    hullForm: 'dive-support vessel, wheelhouse forward, low working deck, A-frame over the stern',
    propulsion: ['power'],
    shows: ['wheelhouse', 'a-frame'],
    loaM: 15,
    fit: [10, 25],
    aisType: 34,
  },
  'wing-in-ground': {
    name: 'Wing-in-ground craft',
    hullForm: 'wing-in-ground craft on the water: flat float hull, canopy, stub wings, T-tail',
    propulsion: ['power'],
    shows: ['wings', 'canopy'],
    loaM: 15,
    fit: [8, 25],
    aisType: 20,
  },
  'restricted-ability': {
    name: 'Buoy tender',
    hullForm: 'buoy tender, bridge forward, long buoy deck aft with a heavy crane',
    propulsion: ['power'],
    shows: ['bridge', 'cranes'],
    loaM: 60,
    fit: [30, 100],
  },
};

function sidecar(hull, stem, name, v) {
  const n = NOMINAL[hull.spec.id];
  if (!n) throw new Error(`no nominal record for ${hull.spec.id}`);
  const loaM = n.loaM;
  const beamM = Math.round(hull.spec.beam * v.beam * loaM * 10) / 10;
  return {
    file: `${stem}.glb`,
    name: name === 'base' ? n.name : `${n.name} (${name})`,
    kind: 'loft',
    fidelity: 'typical',
    source: {
      url: 'https://github.com/mark-brannan/nav-wright/blob/main/src/hulls.tsx',
      license: 'AGPL-3.0',
    },
    hullForm: n.hullForm,
    ...(n.rig ? { rig: n.rig } : {}),
    propulsion: n.propulsion,
    shows: n.shows,
    loaM,
    beamM,
    draftM: null,
    nominal: true,
    fitLengthM: n.fit,
    ...(n.aisType ? { aisType: n.aisType } : {}),
  };
}

mkdirSync(OUT, { recursive: true });
for (const hull of Object.values(allHulls)) {
  for (const [name, v] of Object.entries(VARIANTS)) {
    const stem = name === 'base' ? `loft-${hull.spec.id}` : `loft-${hull.spec.id}-${name}`;
    const bytes = glb(
      buildHull(hull, { ...v, ...(name === 'base' ? {} : EXTRAS[hull.spec.id]) }),
      name === 'base' ? hull.spec.id : stem,
      { generator: 'nav-wright scripts/loft-hulls.mjs', colours: COLOURS },
    );
    writeFileSync(join(OUT, `${stem}.glb`), bytes);
    writeFileSync(
      join(OUT, `${stem}.json`),
      JSON.stringify(sidecar(hull, stem, name, v), null, 2) + '\n',
    );
    console.log(`${stem.padEnd(28)} ${(bytes.length / 1024).toFixed(0).padStart(4)} KB`);
  }
}
