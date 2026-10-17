// Turns a hand-traced sailboat drawing (docs/research/sailboat-lines/<id>.json)
// into SVGs of its profile, plan, body plan and a lofted 3D view, so a traced
// hull can be judged by eye before it goes anywhere near src/hulls.tsx, and
// into models/<id>.glb, the same loft as a mesh the 3D views can show
// (MODELS.md).
//
//   node scripts/sailboat-lines.mjs [id ...]     (default: every json there)
//
// Units are feet, x forward from the transom, z up from the waterline, y to
// starboard. The loft has no lines plan to work from: sections are a rounded
// canoe body down to an assumed depth, with the keel below it as a thin fin
// following the traced profile. Deterministic: same trace, same files.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glb } from './glb.mjs';

const MODELS = join(dirname(fileURLToPath(import.meta.url)), '..', 'models');
const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'research',
  'sailboat-lines',
);

/**
 * Loft defaults, for a yacht; a trace's `loft` overrides any of them. canoeDepth
 * is the canoe body's depth below the waterline at its deepest, as a fraction
 * of draft; keelTop and keelBottom the keel's half-thickness in ft at the
 * garboard and at the bottom; bilge the section roundness (2 is elliptical,
 * higher is boxier); fullness the exponent on the canoe body's depth along the
 * waterline (1 is a sine, lower holds full depth further toward the ends).
 */
const LOFT = { canoeDepth: 0.4, keelTop: 0.55, keelBottom: 0.3, bilge: 2.4, fullness: 0.7 };
const STATIONS = 48;
/** Rig entries drawn as spars; the rest are wire. Masts are the keys ending in "mast". */
const SPAR = /(mast|boom|bowsprit|boomkin|gaff|yard)$/i;
const MAST = /mast$/i;
const SECTION = 28;

const f = (n) => (Math.round(n * 100) / 100).toString();

function interp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/** z values where a vertical line at x crosses a closed polygon. */
function slice(poly, x) {
  const zs = [];
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i];
    const [x1, z1] = poly[(i + 1) % poly.length];
    if ((x0 <= x && x < x1) || (x1 <= x && x < x0))
      zs.push(z0 + ((z1 - z0) * (x - x0)) / (x1 - x0));
  }
  return zs;
}

function model(trace) {
  const { profile, plan } = trace;
  // LOA spans the hull's ends unless the trace names them: an outboard rudder
  // or a boomkin drawn into the outline would otherwise stretch the scale.
  const [transomX, stemX] = profile.loaFromX ?? [
    Math.min(...profile.hull.map((p) => p[0])),
    Math.max(...profile.hull.map((p) => p[0])),
  ];
  const ftPerPx = trace.specs.loaFt / (stemX - transomX);
  const wl = profile.waterlineY;
  const P = ([x, y]) => [(x - transomX) * ftPerPx, (wl - y) * ftPerPx];
  const hull = profile.hull.map(P);
  const loa = trace.specs.loaFt;
  const half = plan.halfBreadth.map(([x, h]) => [(x - transomX) * ftPerPx, h * ftPerPx]);

  const top = (x) => Math.max(...slice(hull, x));
  const bottom = (x) => Math.min(...slice(hull, x));
  const beam = (x) => interp(half, x);
  // The waterline's ends are where the bottom crosses z = 0.
  const xs = Array.from({ length: 400 }, (_, i) => (loa * (i + 0.5)) / 400);
  const wet = xs.filter((x) => bottom(x) < 0);
  const [wlAft, wlFwd] = [wet[0], wet[wet.length - 1]];
  const draft = -Math.min(...xs.map(bottom));
  const L = { ...LOFT, ...trace.loft };
  const canoe = (x) => {
    const t = (x - wlAft) / (wlFwd - wlAft);
    const dip = t <= 0 || t >= 1 ? 0 : L.canoeDepth * draft * Math.sin(Math.PI * t) ** L.fullness;
    return Math.max(bottom(x), -dip);
  };

  // Traced stations, when the trace has a body plan to work from: each is
  // normalised to its own sheer half-breadth and its own sheer-to-keel depth,
  // then stretched over this hull's profile and plan at the same fraction of
  // its length. The keel and canoe-body defaults are then not used.
  const stations = (trace.sections?.stations ?? [])
    .map(({ t, pts }) => {
      const zs = pts.map((p) => p[1]);
      const [lo, hi] = [Math.min(...zs), Math.max(...zs)];
      const sheer = pts.find((p) => p[1] === hi)[0];
      const shape = pts
        .map(([h, z]) => [(z - lo) / (hi - lo), h / sheer])
        .sort((a, b) => a[0] - b[0]);
      return { x: t * loa, shape };
    })
    .sort((a, b) => a.x - b.x);
  const traced = (x, z) => {
    const zt = top(x);
    const zb = bottom(x);
    if (z > zt || z < zb) return 0;
    const zeta = (z - zb) / Math.max(zt - zb, 1e-6);
    const n = stations.length - 1;
    const after = stations.findIndex((s) => s.x > x);
    const [i, j] = after < 0 ? [n, n] : after === 0 ? [0, 0] : [after - 1, after];
    const k = i === j ? 0 : (x - stations[i].x) / (stations[j].x - stations[i].x);
    const eta = (1 - k) * interp(stations[i].shape, zeta) + k * interp(stations[j].shape, zeta);
    return beam(x) * eta;
  };

  /** Half-breadth of the section at station x, height z. */
  const y = (x, z) => {
    if (stations.length) return traced(x, z);
    const zt = top(x);
    const zc = canoe(x);
    const zb = bottom(x);
    if (z > zt || z < zb) return 0;
    const keel =
      zc - zb < 0.05
        ? 0
        : L.keelBottom + (L.keelTop - L.keelBottom) * Math.min(1, (z - zb) / (zc - zb));
    if (z < zc) return Math.min(keel, beam(x));
    const u = Math.min(1, (zt - z) / Math.max(zt - zc, 1e-6));
    return Math.max(keel, beam(x) * (1 - u ** L.bilge) ** (1 / L.bilge));
  };

  /** Section outline from sheer to keel bottom, starboard half. */
  const section = (x) => {
    const zt = top(x);
    const zb = bottom(x);
    return Array.from({ length: SECTION + 1 }, (_, j) => {
      // Traced stations crowd the samples toward the keel, where a ship's flat
      // floor turns into its bilge within a few percent of the depth.
      const z = stations.length
        ? zt - (zt - zb) * (1 - (1 - j / SECTION) ** 1.6)
        : zt - ((zt - zb) * j) / SECTION;
      return [y(x, z), z];
    });
  };

  const rig = Object.fromEntries(Object.entries(profile.rig).map(([k, v]) => [k, v.map(P)]));
  const boottop = profile.boottopTopY.map(P);
  // A yacht's coachroof, or a ship's several deckhouses: each a polyline from
  // the aft foot over the top to the forward foot. The feet give its ends,
  // the points between them its top.
  const houses = (profile.houses ?? [profile.coachroof]).map((h) => h.map(P));
  const houseX = houses.map((h) => [h[0][0], h[h.length - 1][0]]);
  const houseTop = houses.map((h) => h.slice(1, -1).sort((a, b) => a[0] - b[0]));
  // Each house's width as a fraction of the deck's: a poop or a topgallant
  // forecastle runs the full beam, a coachroof or a deckhouse less.
  const houseBreadth = houses.map((_, i) => profile.houseBreadth?.[i] ?? 0.62);
  // Line weights, labels and the camera grow with the boat past 60 ft, so a
  // ship reads at the same size as a yacht; smaller boats draw as before.
  const u = Math.max(1, loa / 60);
  return {
    trace,
    loa,
    hull,
    half,
    top,
    bottom,
    beam,
    canoe,
    y,
    section,
    rig,
    boottop,
    houses,
    houseX,
    houseTop,
    houseBreadth,
    L,
    traced: stations.length,
    u,
    wlAft,
    wlFwd,
    draft,
    ftPerPx,
  };
}

// ---- drawing ---------------------------------------------------------------

const C = {
  ink: '#1d2733',
  topsides: '#14304f',
  bottom: '#9c3b2f',
  deck: '#d9cfb8',
  house: '#efe9dc',
  water: '#3d7ea6',
  rig: '#5a6470',
  grid: '#b9c3cc',
  bg: '#f7f5f0',
};

const pathOf = (pts, close = true) =>
  pts.map(([a, b], i) => `${i ? 'L' : 'M'}${f(a)},${f(b)}`).join(' ') + (close ? ' Z' : '');

function svg(w, h, body, title, u = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f((w * 24) / u)}" height="${f((h * 24) / u)}" font-family="system-ui, sans-serif">
<title>${title}</title>
<rect width="100%" height="100%" fill="${C.bg}"/>
${body}
</svg>
`;
}

const label = (x, y, text, size = 1.1) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${f(size)}" fill="${C.ink}">${text}</text>`;

/** Side elevation, bow right; one SVG unit is one foot. */
function profileSvg(m) {
  const pad = 2 * m.u;
  const zMax = Math.max(...Object.values(m.rig).flatMap((s) => s.map((p) => p[1])));
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const xMin = Math.min(0, ...spars);
  const xMax = Math.max(m.loa, ...spars) - xMin;
  const X = (x) => x - xMin + pad;
  const Y = (z) => zMax + pad - z;
  const T = (pts) => pts.map(([x, z]) => [X(x), Y(z)]);
  const w = xMax + 2 * pad;
  const h = zMax + m.draft + 2 * pad + m.u;
  // Topsides from the sheer down to the boot-top; bottom paint below it.
  const n = 80;
  const span = Array.from({ length: n + 1 }, (_, i) => (m.loa * i) / n).map((x) =>
    Math.min(Math.max(x, 0.01), m.loa - 0.01),
  );
  const boot = (x) => Math.min(m.top(x), Math.max(m.bottom(x), interp(m.boottop, x)));
  const topsides = [...span.map((x) => [x, m.top(x)]), ...span.reverse().map((x) => [x, boot(x)])];
  const rig = Object.entries(m.rig)
    .map(([k, [a, b]]) => {
      const sw = (SPAR.test(k) ? 0.35 : 0.08) * m.u;
      return `<line x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}" stroke="${C.rig}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join('\n');
  const body = `
<rect x="0" y="${f(Y(0))}" width="${f(w)}" height="${f(h - Y(0))}" fill="${C.water}" opacity="0.12"/>
${rig}
<path d="${pathOf(T(m.hull))}" fill="${C.bottom}" stroke="${C.ink}" stroke-width="${f(0.12 * m.u)}"/>
<path d="${pathOf(T(topsides))}" fill="${C.topsides}"/>
${m.houses.map((hs) => `<path d="${pathOf(T(hs), false)}" fill="${C.house}" stroke="${C.ink}" stroke-width="${f(0.1 * m.u)}"/>`).join('\n')}
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.water}" stroke-width="${f(0.1 * m.u)}"/>
${label(pad, h - 0.6 * m.u, `${m.trace.name} — profile, traced. LOA ${m.loa} ft, draft ${f(m.draft)} ft traced (${m.trace.specs.draftFt} spec)`, 1.1 * m.u)}`;
  return svg(w, h, body, `${m.trace.name} profile`, m.u);
}

/** Deck plan, bow right, with the waterline from the loft dashed inside it. */
function planSvg(m) {
  const pad = 2 * m.u;
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const xMin = Math.min(0, ...spars);
  const bMax = Math.max(...m.half.map((p) => p[1]));
  const w = Math.max(...spars) - xMin + 2 * pad;
  const h = 2 * bMax + 2 * pad + 2 * m.u;
  const X = (x) => x - xMin + pad;
  const Y = (y) => bMax + pad - y;
  const n = 120;
  const xs = Array.from({ length: n + 1 }, (_, i) => (m.loa * i) / n);
  const deck = [
    ...xs.map((x) => [X(x), Y(m.beam(x))]),
    ...[...xs].reverse().map((x) => [X(x), Y(-m.beam(x))]),
  ];
  const wlXs = xs.filter((x) => x > m.wlAft && x < m.wlFwd);
  const wlLine = [
    ...wlXs.map((x) => [X(x), Y(m.y(x, 0))]),
    ...[...wlXs].reverse().map((x) => [X(x), Y(-m.y(x, 0))]),
  ];
  const houses = m.houseX.map(([x0, x1], i) => {
    const k = m.houseBreadth[i];
    const crXs = Array.from({ length: 21 }, (_, i) => x0 + ((x1 - x0) * i) / 20);
    return [
      ...crXs.map((x) => [X(x), Y(k * m.beam(x))]),
      ...[...crXs].reverse().map((x) => [X(x), Y(-k * m.beam(x))]),
    ];
  });
  const centreSpars = ['bowsprit', 'boomkin']
    .filter((k) => m.rig[k])
    .map((k) => {
      const [a, b] = m.rig[k];
      return `<line x1="${f(X(a[0]))}" y1="${f(Y(0))}" x2="${f(X(b[0]))}" y2="${f(Y(0))}" stroke="${C.rig}" stroke-width="${f(0.4 * m.u)}" stroke-linecap="round"/>`;
    })
    .join('\n');
  const masts = Object.keys(m.rig)
    .filter((k) => MAST.test(k))
    .map((k) => m.rig[k][0][0]);
  const inferred =
    (m.trace.plan.inferredFromX -
      m.trace.profile.hull.reduce((a, p) => Math.min(a, p[0]), Infinity)) *
    m.ftPerPx;
  const body = `
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.grid}" stroke-width="${f(0.08 * m.u)}" stroke-dasharray="${f(0.6 * m.u)} ${f(0.3 * m.u)}"/>
${centreSpars}
<path d="${pathOf(deck)}" fill="${C.deck}" stroke="${C.ink}" stroke-width="${f(0.14 * m.u)}"/>
<path d="${pathOf(wlLine)}" fill="none" stroke="${C.water}" stroke-width="${f(0.1 * m.u)}" stroke-dasharray="${f(0.4 * m.u)} ${f(0.25 * m.u)}"/>
${houses.map((hs) => `<path d="${pathOf(hs)}" fill="${C.house}" stroke="${C.ink}" stroke-width="${f(0.08 * m.u)}"/>`).join('\n')}
${masts.map((x) => `<circle cx="${f(X(x))}" cy="${f(Y(0))}" r="${f(0.35 * m.u)}" fill="${C.rig}"/>`).join('\n')}
<line x1="${f(X(inferred))}" y1="${f(Y(bMax))}" x2="${f(X(inferred))}" y2="${f(Y(-bMax))}" stroke="#c07a00" stroke-width="${f(0.06 * m.u)}" stroke-dasharray="${f(0.3 * m.u)} ${f(0.3 * m.u)}"/>
${label(X(inferred) + 0.3 * m.u, Y(bMax) + 0.4 * m.u, 'inferred →', 0.8 * m.u)}
${label(pad, h - 0.6 * m.u, `plan, traced. Beam ${f(2 * bMax)} ft traced (${m.trace.specs.beamFt} spec); dashed blue = loft waterline`, 1.1 * m.u)}`;
  return svg(w, h, body, `${m.trace.name} plan`, m.u);
}

/** Classic body plan: aft stations on the left half, forward on the right. */
function bodyPlanSvg(m) {
  // This view is only a beam wide, so it takes its weights from the beam.
  m = { ...m, u: Math.max(1, Math.max(...m.half.map((p) => p[1])) / 10) };
  const pad = 2 * m.u;
  const bMax = Math.max(...m.half.map((p) => p[1]));
  const zTop = Math.max(...Array.from({ length: 50 }, (_, i) => m.top((m.loa * (i + 0.5)) / 50)));
  const w = 2 * bMax + 2 * pad;
  const h = zTop + m.draft + 2 * pad + 2 * m.u;
  const X = (y) => bMax + pad + y;
  const Y = (z) => zTop + pad - z;
  const n = 10;
  const lines = [];
  for (let i = 1; i < n; i++) {
    const x = (m.loa * i) / n;
    const side = x < m.loa / 2 ? -1 : 1;
    const pts = m.section(x).map(([y, z]) => [X(side * y), Y(z)]);
    lines.push(
      `<path d="${pathOf(pts, false)}" fill="none" stroke="${side < 0 ? C.bottom : C.topsides}" stroke-width="${f(0.09 * m.u)}"/>`,
    );
  }
  const body = `
<line x1="${f(X(0))}" y1="0" x2="${f(X(0))}" y2="${f(h)}" stroke="${C.grid}" stroke-width="${f(0.06 * m.u)}"/>
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.water}" stroke-width="${f(0.08 * m.u)}"/>
${lines.join('\n')}
${label(pad, h - 0.6 * m.u, 'body plan, lofted: aft ← | → fwd, 10 stations', 0.9 * m.u)}`;
  return svg(w, h, body, `${m.trace.name} body plan`, m.u);
}

/** Flat-shaded perspective of the loft, painter-sorted. */
function loftSvg(m, { yaw = -0.62, pitch = 0.32 } = {}) {
  const stations = Array.from({ length: STATIONS + 1 }, (_, i) =>
    Math.min(Math.max((m.loa * i) / STATIONS, 0.02), m.loa - 0.02),
  );
  const rings = stations.map((x) => m.section(x).map(([y, z]) => [x, y, z]));
  const cx = m.loa / 2;
  const cam = ([x, y, z]) => {
    const X0 = x - cx;
    const xr = X0 * Math.cos(yaw) - y * Math.sin(yaw);
    const yr = X0 * Math.sin(yaw) + y * Math.cos(yaw);
    // Camera above the water, looking down by `pitch`: far points rise on screen.
    const zr = z * Math.cos(pitch) + yr * Math.sin(pitch);
    const depth = yr * Math.cos(pitch) - z * Math.sin(pitch);
    const s = (90 * m.u) / (90 * m.u + depth);
    return [xr * s, -zr * s, depth];
  };
  const light = (() => {
    const v = [-0.35, -0.55, 0.75];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  })();
  const faces = [];
  const shade = (pts, base) => {
    const [a, b, c] = pts;
    const u = b.map((v, k) => v - a[k]);
    const v = c.map((w, k) => w - a[k]);
    let nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...nrm) || 1;
    nrm = nrm.map((q) => q / l);
    const k = 0.45 + 0.55 * Math.abs(nrm[0] * light[0] + nrm[1] * light[1] + nrm[2] * light[2]);
    const hex = base.match(/\w\w/g).map((h) => Math.round(parseInt(h, 16) * k));
    return `rgb(${hex.join(',')})`;
  };
  const push = (pts, base) => {
    const p = pts.map(cam);
    const wet = pts.reduce((s, q) => s + q[2], 0) / pts.length < 0;
    faces.push({ d: p.reduce((s, q) => s + q[2], 0) / p.length, p, fill: shade(pts, base), wet });
  };
  for (const side of [1, -1]) {
    for (let i = 0; i < STATIONS; i++) {
      for (let j = 0; j < SECTION; j++) {
        const q = [rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]].map(
          ([x, y, z]) => [x, side * y, z],
        );
        const zMid = q.reduce((s, p) => s + p[2], 0) / 4;
        push(q, zMid > 0.15 ? C.topsides : C.bottom);
      }
    }
  }
  // Deck, a strip across the sheer.
  for (let i = 0; i < STATIONS; i++) {
    const [a, b] = [rings[i][0], rings[i + 1][0]];
    push(
      [
        [a[0], a[1], a[2]],
        [b[0], b[1], b[2]],
        [b[0], -b[1], b[2]],
        [a[0], -a[1], a[2]],
      ],
      C.deck,
    );
  }
  // Each house as a lofted box.
  for (const [h, [x0, x1]] of m.houseX.entries()) {
    const k = m.houseBreadth[h];
    const hx = Array.from({ length: 13 }, (_, i) => x0 + ((x1 - x0) * i) / 12);
    for (let i = 0; i < 12; i++) {
      const [xa, xb] = [hx[i], hx[i + 1]];
      const za = m.top(xa);
      const zb = m.top(xb);
      const ta = interp(m.houseTop[h], xa);
      const tb = interp(m.houseTop[h], xb);
      const [wa, wb] = [k * m.beam(xa), k * m.beam(xb)];
      push(
        [
          [xa, wa, ta],
          [xb, wb, tb],
          [xb, -wb, tb],
          [xa, -wa, ta],
        ],
        C.house,
      );
      for (const s of [1, -1])
        push(
          [
            [xa, s * wa, za],
            [xb, s * wb, zb],
            [xb, s * wb, tb],
            [xa, s * wa, ta],
          ],
          C.house,
        );
    }
  }
  faces.sort((a, b) => b.d - a.d);
  const all = faces.flatMap((q) => q.p);
  const rigLines = Object.entries(m.rig).map(([k, [a, b]]) => {
    const [p, q] = [cam([a[0], 0, a[1]]), cam([b[0], 0, b[1]])];
    all.push(p, q);
    return { p, q, w: (SPAR.test(k) ? 0.3 : 0.07) * m.u };
  });
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 2 * m.u;
  const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  const w = Math.max(...xs) - x0 + pad;
  const h = Math.max(...ys) - y0 + pad + 1.5 * m.u;
  const P = ([x, y]) => `${f(x - x0)},${f(y - y0)}`;
  // Waterplane: a translucent sheet drawn over the underbody.
  const sea = [
    [-4 * m.u, -10 * m.u, 0],
    [m.loa + 10 * m.u, -10 * m.u, 0],
    [m.loa + 10 * m.u, 10 * m.u, 0],
    [-4 * m.u, 10 * m.u, 0],
  ].map(cam);
  // From above, the sea hides all that is under it and nothing above it.
  const back = faces.filter((q) => q.wet);
  const front = faces.filter((q) => !q.wet);
  const poly = (q) =>
    `<polygon points="${q.p.map(P).join(' ')}" fill="${q.fill}" stroke="${q.fill}" stroke-width="${f(0.03 * m.u)}"/>`;
  const body = `
${back.map(poly).join('\n')}
<polygon points="${sea.map(P).join(' ')}" fill="${C.water}" opacity="0.45"/>
${front.map(poly).join('\n')}
${rigLines.map(({ p, q, w: sw }) => `<line x1="${f(p[0] - x0)}" y1="${f(p[1] - y0)}" x2="${f(q[0] - x0)}" y2="${f(q[1] - y0)}" stroke="${C.rig}" stroke-width="${sw}" stroke-linecap="round"/>`).join('\n')}
${label(pad, h - 0.6 * m.u, m.traced ? `lofted from profile + plan + ${m.traced} traced sections, ${STATIONS} stations` : `lofted from profile + plan; canoe body ${f(m.L.canoeDepth * 100)}% of draft (assumed), ${STATIONS} stations`, 0.9 * m.u)}`;
  return svg(w, h, body, `${m.trace.name} loft`, m.u);
}

// ---- mesh ------------------------------------------------------------------

/** Mesh colours, 0..1: the drawing's paints. */
const MESH = {
  topsides: [0.08, 0.19, 0.31],
  bottom: [0.61, 0.23, 0.18],
  deck: [0.85, 0.81, 0.72],
  house: [0.94, 0.91, 0.86],
  rig: [0.35, 0.39, 0.44],
};

/** A box of half-width w along the segment A..B, both 3D points in feet. */
function bar(part, A, B, w) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const len = Math.hypot(...d);
  if (len < 1e-6) return;
  const u = d.map((c) => c / len);
  // Two unit vectors across the bar: athwartships when it lies in the
  // centreline plane, else whatever is perpendicular.
  const pick = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const n1 = [
    u[1] * pick[2] - u[2] * pick[1],
    u[2] * pick[0] - u[0] * pick[2],
    u[0] * pick[1] - u[1] * pick[0],
  ];
  const l1 = Math.hypot(...n1);
  const a = n1.map((c) => (c / l1) * w);
  const n2 = [u[1] * a[2] - u[2] * a[1], u[2] * a[0] - u[0] * a[2], u[0] * a[1] - u[1] * a[0]];
  const l2 = Math.hypot(...n2);
  const b = n2.map((c) => (c / l2) * w);
  const ring = (P) =>
    [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ].map(([sa, sb]) => P.map((c, k) => c + sa * a[k] + sb * b[k]));
  const ra = ring(A);
  const rb = ring(B);
  for (let k = 0; k < 4; k++) part.quad(ra[k], rb[k], rb[(k + 1) % 4], ra[(k + 1) % 4]);
  part.quad(ra[3], ra[2], ra[1], ra[0]);
  part.quad(rb[0], rb[1], rb[2], rb[3]);
}

class Part {
  constructor(scale) {
    this.pos = [];
    this.s = scale;
  }
  tri(a, b, c) {
    for (const p of [a, b, c]) this.pos.push(...this.s(p));
  }
  quad(a, b, c, d) {
    this.tri(a, b, c);
    this.tri(a, c, d);
  }
}

/**
 * The loft as a glTF binary in the Benchy convention (MODELS.md): Z up, bow
 * on +X, half-length units, the waterline at z = 0 and the keel below it.
 * True aspect, feet all round, so a 12 ft beam is 12 ft and the mast stands
 * where the drawing puts it. The root node's extras carry `waterlineZ`, so
 * placement floats her instead of standing her on her keel, and `hullX`, the
 * hull's own extent, so a bowsprit or a boomkin does not shorten her when
 * the mesh is fitted to a length.
 */
function loftGlb(m) {
  const k = 2 / m.loa;
  const toModel = ([x, y, z]) => [(x - m.loa / 2) * k, y * k, z * k];
  const parts = Object.fromEntries(Object.keys(MESH).map((n) => [n, new Part(toModel)]));
  const stations = Array.from({ length: STATIONS + 1 }, (_, i) =>
    Math.min(Math.max((m.loa * i) / STATIONS, 0.02), m.loa - 0.02),
  );
  const rings = stations.map((x) => m.section(x).map(([y, z]) => [x, y, z]));
  for (const side of [1, -1])
    for (let i = 0; i < STATIONS; i++)
      for (let j = 0; j < SECTION; j++) {
        const q = [rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]].map(
          ([x, y, z]) => [x, side * y, z],
        );
        const zMid = q.reduce((s, p) => s + p[2], 0) / 4;
        const xMid = q.reduce((s, p) => s + p[0], 0) / 4;
        const wet = zMid < interp(m.boottop, xMid);
        (wet ? parts.bottom : parts.topsides).quad(...(side > 0 ? q : [...q].reverse()));
      }
  for (let i = 0; i < STATIONS; i++) {
    const [a, b] = [rings[i][0], rings[i + 1][0]];
    parts.deck.quad(
      [a[0], -a[1], a[2]],
      [b[0], -b[1], b[2]],
      [b[0], b[1], b[2]],
      [a[0], a[1], a[2]],
    );
  }
  // The ends: a transom or a counter's tip is a flat face across the end
  // ring; a stem's ring has no breadth and closes on itself.
  for (const ring of [rings[0], rings[STATIONS]]) {
    if (Math.max(...ring.map(([, y]) => y)) < 0.01) continue;
    const x = ring[0][0];
    const wet = interp(m.boottop, x);
    for (let j = 0; j < SECTION; j++) {
      const [a, b] = [ring[j], ring[j + 1]];
      const part = (a[2] + b[2]) / 2 < wet ? parts.bottom : parts.topsides;
      part.quad([x, a[1], a[2]], [x, b[1], b[2]], [x, -b[1], b[2]], [x, -a[1], a[2]]);
    }
  }
  for (const [h, [x0, x1]] of m.houseX.entries()) {
    const kb = m.houseBreadth[h];
    const n = 12;
    const hx = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
    const box = (x) => ({ w: kb * m.beam(x), floor: m.top(x), top: interp(m.houseTop[h], x) });
    for (let i = 0; i < n; i++) {
      const [xa, xb] = [hx[i], hx[i + 1]];
      const A = box(xa);
      const B = box(xb);
      parts.house.quad([xa, -A.w, A.top], [xb, -B.w, B.top], [xb, B.w, B.top], [xa, A.w, A.top]);
      for (const s of [1, -1])
        parts.house.quad(
          [xa, s * A.w, A.floor],
          [xb, s * B.w, B.floor],
          [xb, s * B.w, B.top],
          [xa, s * A.w, A.top],
        );
    }
    for (const x of [hx[0], hx[n]]) {
      const E = box(x);
      parts.house.quad([x, -E.w, E.floor], [x, E.w, E.floor], [x, E.w, E.top], [x, -E.w, E.top]);
    }
  }
  for (const [name, [a, b]] of Object.entries(m.rig))
    bar(parts.rig, [a[0], 0, a[1]], [b[0], 0, b[1]], (SPAR.test(name) ? 0.18 : 0.04) * m.u);
  return glb(parts, m.trace.name, {
    generator: 'nav-wright scripts/sailboat-lines.mjs',
    colours: MESH,
    extras: { waterlineZ: 0, hullX: [-1, 1], loaFt: m.loa },
  });
}

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR)
      .filter((n) => n.endsWith('.json'))
      .map((n) => n.slice(0, -5));
for (const id of ids) {
  const m = model(JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8')));
  const out = {
    profile: profileSvg(m),
    plan: planSvg(m),
    bodyplan: bodyPlanSvg(m),
    loft: loftSvg(m),
  };
  for (const [k, s] of Object.entries(out)) writeFileSync(join(DIR, `${id}-${k}.svg`), s);
  const bytes = loftGlb(m);
  writeFileSync(join(MODELS, `${id}.glb`), bytes);
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const sparred = Math.max(m.loa, ...spars) - Math.min(0, ...spars);
  console.log(
    `${id}: sparred ${f(sparred)} ft (spec ${m.trace.specs.sparredLengthFt ?? '-'}), LWL ${f(m.wlFwd - m.wlAft)} ft (spec ${m.trace.specs.lwlFt}), draft ${f(m.draft)} ft (spec ${m.trace.specs.draftFt}), ${f(1 / m.ftPerPx)} px/ft, ${(bytes.length / 1024).toFixed(0)} KB glb`,
  );
}

// The manifest a consumer imports to list every traced vessel's mesh:
// src/tracedVessels.ts, from every trace in DIR whatever ids were asked for.
{
  const FT = 0.3048;
  const round = (x) => Math.round(x * FT * 100) / 100;
  const vessels = readdirSync(DIR)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => {
      const id = n.slice(0, -5);
      const { name, specs: s } = JSON.parse(readFileSync(join(DIR, n), 'utf8'));
      return {
        id,
        name,
        model: `${id}.glb`,
        loaM: round(s.loaFt),
        beamM: round(s.beamFt),
        draftM: round(s.draftFt),
        ...(s.rig ? { rig: s.rig } : {}),
      };
    });
  const src = `// Generated by scripts/sailboat-lines.mjs — do not edit.
// Every hand-traced real sailing vessel (docs/research/sailboat-lines), with
// the file name of her mesh under \`nav-wright/models/\`. Lengths in metres.

export interface TracedVessel {
  id: string;
  name: string;
  /** File under \`nav-wright/models/\`, e.g. \`westsail-32-lines.glb\`. */
  model: string;
  loaM: number;
  beamM: number;
  draftM: number;
  rig?: string;
}

export const tracedVessels: readonly TracedVessel[] = ${JSON.stringify(vessels, null, 2)};
`;
  writeFileSync(join(DIR, '../../../src/tracedVessels.ts'), src);
}
