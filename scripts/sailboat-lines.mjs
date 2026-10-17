// Turns a hand-traced sailboat drawing (docs/research/sailboat-lines/<id>.json)
// into SVGs of its profile, plan, body plan and a lofted 3D view, so a traced
// hull can be judged by eye before it goes anywhere near src/hulls.tsx.
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

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'docs',
  'research',
  'sailboat-lines',
);

/** Canoe-body depth below the waterline at its deepest, as a fraction of draft. */
const CANOE_DEPTH = 0.4;
/** Keel half-thickness at the garboard and at the bottom, ft. */
const KEEL_TOP = 0.55;
const KEEL_BOTTOM = 0.3;
/** Bilge roundness: 2 is elliptical, higher is boxier. */
const BILGE = 2.4;
const STATIONS = 48;
/** Rig entries drawn as spars; the rest are wire. */
const SPARS = new Set(['mast', 'boom', 'bowsprit', 'boomkin']);
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
  const canoe = (x) => {
    const t = (x - wlAft) / (wlFwd - wlAft);
    const dip = t <= 0 || t >= 1 ? 0 : CANOE_DEPTH * draft * Math.sin(Math.PI * t) ** 0.7;
    return Math.max(bottom(x), -dip);
  };

  /** Half-breadth of the section at station x, height z. */
  const y = (x, z) => {
    const zt = top(x);
    const zc = canoe(x);
    const zb = bottom(x);
    if (z > zt || z < zb) return 0;
    const keel =
      zc - zb < 0.05
        ? 0
        : KEEL_BOTTOM + (KEEL_TOP - KEEL_BOTTOM) * Math.min(1, (z - zb) / (zc - zb));
    if (z < zc) return Math.min(keel, beam(x));
    const u = Math.min(1, (zt - z) / Math.max(zt - zc, 1e-6));
    return Math.max(keel, beam(x) * (1 - u ** BILGE) ** (1 / BILGE));
  };

  /** Section outline from sheer to keel bottom, starboard half. */
  const section = (x) => {
    const zt = top(x);
    const zb = bottom(x);
    return Array.from({ length: SECTION + 1 }, (_, j) => {
      const z = zt - ((zt - zb) * j) / SECTION;
      return [y(x, z), z];
    });
  };

  const rig = Object.fromEntries(Object.entries(profile.rig).map(([k, v]) => [k, v.map(P)]));
  const boottop = profile.boottopTopY.map(P);
  const coachroof = profile.coachroof.map(P);
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
    coachroof,
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

function svg(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w * 24)}" height="${f(h * 24)}" font-family="system-ui, sans-serif">
<title>${title}</title>
<rect width="100%" height="100%" fill="${C.bg}"/>
${body}
</svg>
`;
}

const label = (x, y, text, size = 1.1) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${C.ink}">${text}</text>`;

/** Side elevation, bow right; one SVG unit is one foot. */
function profileSvg(m) {
  const pad = 2;
  const zMax = Math.max(...m.rig.mast.map((p) => p[1]));
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const xMin = Math.min(0, ...spars);
  const xMax = Math.max(m.loa, ...spars) - xMin;
  const X = (x) => x - xMin + pad;
  const Y = (z) => zMax + pad - z;
  const T = (pts) => pts.map(([x, z]) => [X(x), Y(z)]);
  const w = xMax + 2 * pad;
  const h = zMax + m.draft + 2 * pad + 1;
  // Topsides from the sheer down to the boot-top; bottom paint below it.
  const n = 80;
  const span = Array.from({ length: n + 1 }, (_, i) => (m.loa * i) / n).map((x) =>
    Math.min(Math.max(x, 0.01), m.loa - 0.01),
  );
  const boot = (x) => Math.min(m.top(x), Math.max(m.bottom(x), interp(m.boottop, x)));
  const topsides = [...span.map((x) => [x, m.top(x)]), ...span.reverse().map((x) => [x, boot(x)])];
  const rig = Object.entries(m.rig)
    .map(([k, [a, b]]) => {
      const sw = SPARS.has(k) ? 0.35 : 0.08;
      return `<line x1="${f(X(a[0]))}" y1="${f(Y(a[1]))}" x2="${f(X(b[0]))}" y2="${f(Y(b[1]))}" stroke="${C.rig}" stroke-width="${sw}" stroke-linecap="round"/>`;
    })
    .join('\n');
  const body = `
<rect x="0" y="${f(Y(0))}" width="${f(w)}" height="${f(h - Y(0))}" fill="${C.water}" opacity="0.12"/>
${rig}
<path d="${pathOf(T(m.hull))}" fill="${C.bottom}" stroke="${C.ink}" stroke-width="0.12"/>
<path d="${pathOf(T(topsides))}" fill="${C.topsides}"/>
<path d="${pathOf(T(m.coachroof), false)}" fill="${C.house}" stroke="${C.ink}" stroke-width="0.1"/>
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.water}" stroke-width="0.1"/>
${label(pad, h - 0.6, `${m.trace.name} — profile, traced. LOA ${m.loa} ft, draft ${f(m.draft)} ft traced (${m.trace.specs.draftFt} spec)`)}`;
  return svg(w, h, body, `${m.trace.name} profile`);
}

/** Deck plan, bow right, with the waterline from the loft dashed inside it. */
function planSvg(m) {
  const pad = 2;
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const xMin = Math.min(0, ...spars);
  const bMax = Math.max(...m.half.map((p) => p[1]));
  const w = Math.max(...spars) - xMin + 2 * pad;
  const h = 2 * bMax + 2 * pad + 2;
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
  const [cr0, , , cr1] = m.coachroof;
  const crXs = Array.from({ length: 21 }, (_, i) => cr0[0] + ((cr1[0] - cr0[0]) * i) / 20);
  const house = [
    ...crXs.map((x) => [X(x), Y(0.62 * m.beam(x))]),
    ...[...crXs].reverse().map((x) => [X(x), Y(-0.62 * m.beam(x))]),
  ];
  const centreSpars = ['bowsprit', 'boomkin']
    .filter((k) => m.rig[k])
    .map((k) => {
      const [a, b] = m.rig[k];
      return `<line x1="${f(X(a[0]))}" y1="${f(Y(0))}" x2="${f(X(b[0]))}" y2="${f(Y(0))}" stroke="${C.rig}" stroke-width="0.4" stroke-linecap="round"/>`;
    })
    .join('\n');
  const mastX = m.rig.mast[0][0];
  const inferred =
    (m.trace.plan.inferredFromX -
      m.trace.profile.hull.reduce((a, p) => Math.min(a, p[0]), Infinity)) *
    m.ftPerPx;
  const body = `
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.grid}" stroke-width="0.08" stroke-dasharray="0.6 0.3"/>
${centreSpars}
<path d="${pathOf(deck)}" fill="${C.deck}" stroke="${C.ink}" stroke-width="0.14"/>
<path d="${pathOf(wlLine)}" fill="none" stroke="${C.water}" stroke-width="0.1" stroke-dasharray="0.4 0.25"/>
<path d="${pathOf(house)}" fill="${C.house}" stroke="${C.ink}" stroke-width="0.08"/>
<circle cx="${f(X(mastX))}" cy="${f(Y(0))}" r="0.35" fill="${C.rig}"/>
<line x1="${f(X(inferred))}" y1="${f(Y(bMax))}" x2="${f(X(inferred))}" y2="${f(Y(-bMax))}" stroke="#c07a00" stroke-width="0.06" stroke-dasharray="0.3 0.3"/>
${label(X(inferred) + 0.3, Y(bMax) + 0.4, 'inferred →', 0.8)}
${label(pad, h - 0.6, `plan, traced. Beam ${f(2 * bMax)} ft traced (${m.trace.specs.beamFt} spec); dashed blue = loft waterline`)}`;
  return svg(w, h, body, `${m.trace.name} plan`);
}

/** Classic body plan: aft stations on the left half, forward on the right. */
function bodyPlanSvg(m) {
  const pad = 2;
  const bMax = Math.max(...m.half.map((p) => p[1]));
  const zTop = Math.max(...Array.from({ length: 50 }, (_, i) => m.top((m.loa * (i + 0.5)) / 50)));
  const w = 2 * bMax + 2 * pad;
  const h = zTop + m.draft + 2 * pad + 2;
  const X = (y) => bMax + pad + y;
  const Y = (z) => zTop + pad - z;
  const n = 10;
  const lines = [];
  for (let i = 1; i < n; i++) {
    const x = (m.loa * i) / n;
    const side = x < m.loa / 2 ? -1 : 1;
    const pts = m.section(x).map(([y, z]) => [X(side * y), Y(z)]);
    lines.push(
      `<path d="${pathOf(pts, false)}" fill="none" stroke="${side < 0 ? C.bottom : C.topsides}" stroke-width="0.09"/>`,
    );
  }
  const body = `
<line x1="${f(X(0))}" y1="0" x2="${f(X(0))}" y2="${f(h)}" stroke="${C.grid}" stroke-width="0.06"/>
<line x1="0" y1="${f(Y(0))}" x2="${f(w)}" y2="${f(Y(0))}" stroke="${C.water}" stroke-width="0.08"/>
${lines.join('\n')}
${label(pad, h - 0.6, 'body plan, lofted: aft ← | → fwd, 10 stations', 0.9)}`;
  return svg(w, h, body, `${m.trace.name} body plan`);
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
    const s = 90 / (90 + depth);
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
  // Coachroof as a lofted box.
  const [cr0, crTop0, crTop1, cr1] = m.coachroof;
  const hx = Array.from({ length: 13 }, (_, i) => cr0[0] + ((cr1[0] - cr0[0]) * i) / 12);
  for (let i = 0; i < 12; i++) {
    const [xa, xb] = [hx[i], hx[i + 1]];
    const za = m.top(xa);
    const zb = m.top(xb);
    const ta = interp([crTop0, crTop1], xa);
    const tb = interp([crTop0, crTop1], xb);
    const [wa, wb] = [0.62 * m.beam(xa), 0.62 * m.beam(xb)];
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
  faces.sort((a, b) => b.d - a.d);
  const all = faces.flatMap((q) => q.p);
  const rigLines = Object.entries(m.rig).map(([k, [a, b]]) => {
    const [p, q] = [cam([a[0], 0, a[1]]), cam([b[0], 0, b[1]])];
    all.push(p, q);
    return { p, q, w: SPARS.has(k) ? 0.3 : 0.07 };
  });
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 2;
  const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys) - pad];
  const w = Math.max(...xs) - x0 + pad;
  const h = Math.max(...ys) - y0 + pad + 1.5;
  const P = ([x, y]) => `${f(x - x0)},${f(y - y0)}`;
  // Waterplane: a translucent sheet drawn over the underbody.
  const sea = [
    [-4, -10, 0],
    [m.loa + 10, -10, 0],
    [m.loa + 10, 10, 0],
    [-4, 10, 0],
  ].map(cam);
  // From above, the sea hides all that is under it and nothing above it.
  const back = faces.filter((q) => q.wet);
  const front = faces.filter((q) => !q.wet);
  const poly = (q) =>
    `<polygon points="${q.p.map(P).join(' ')}" fill="${q.fill}" stroke="${q.fill}" stroke-width="0.03"/>`;
  const body = `
${back.map(poly).join('\n')}
<polygon points="${sea.map(P).join(' ')}" fill="${C.water}" opacity="0.45"/>
${front.map(poly).join('\n')}
${rigLines.map(({ p, q, w: sw }) => `<line x1="${f(p[0] - x0)}" y1="${f(p[1] - y0)}" x2="${f(q[0] - x0)}" y2="${f(q[1] - y0)}" stroke="${C.rig}" stroke-width="${sw}" stroke-linecap="round"/>`).join('\n')}
${label(pad, h - 0.6, `lofted from profile + plan; canoe body ${CANOE_DEPTH * 100}% of draft (assumed), ${STATIONS} stations`, 0.9)}`;
  return svg(w, h, body, `${m.trace.name} loft`);
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
  const spars = Object.values(m.rig)
    .flat()
    .map((p) => p[0]);
  const sparred = Math.max(m.loa, ...spars) - Math.min(0, ...spars);
  console.log(
    `${id}: sparred ${f(sparred)} ft (owner ${m.trace.specs.sparredLengthFt ?? '-'}), LWL ${f(m.wlFwd - m.wlAft)} ft (spec ${m.trace.specs.lwlFt}), draft ${f(m.draft)} ft (spec ${m.trace.specs.draftFt}), ${f(1 / m.ftPerPx)} px/ft`,
  );
}
