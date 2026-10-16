// Hull styles: ways to paint the roster. A style is a set of variants for
// every hull, not a candidate in a contest — every style ships, and a
// consumer may show one class in any of them (as the settings change, say).
//
// A style is a paint layer, not a redrawing. The hull drawings in hulls.tsx
// paint with three custom properties (--hull-fill, --hull-stroke,
// --rig-stroke); a style points those, and the scene's --sea-night,
// --sea-below and --waterline, at its own gradients and patterns, scoped to
// one <svg>. It may add what the line drawings leave out (sails, a
// reflection), always derived from the drawing's own coordinates. No
// HullSpec changes, so light placement is the same in every style.

import { useId } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { Hull } from './hulls.js';
import { PX, PZ } from './hulls.js';

/** A colour, or a two-or-more-stop linear gradient. `across: true` runs it
 *  left to right instead of top to bottom. `scene: true` lays it over the
 *  whole profile view (light from above) instead of each shape's own box —
 *  the only kind a stroke may use, since a straight line has an empty box. */
export type Paint =
  | string
  | {
      stops: readonly (readonly [offset: number, color: string, opacity?: number])[];
      across?: boolean;
      scene?: boolean;
    };

/** Engraver's hatching over a flat ground. */
export interface Hatch {
  hatch: { ground: string; ink: string; gap: number; angle: number; width: number };
}

export type Fill = Paint | Hatch;

export interface HullStyle {
  id: string;
  /** Display name, for a gallery or a caption. */
  name: string;
  /** One line on the look. */
  note: string;
  /** Profile view: sky above the waterline, sea below it, and the line. */
  sky: Fill;
  sea: Fill;
  waterline: string;
  hullFill: Fill;
  hullStroke: Paint;
  rig: string;
  /** Sails, drawn for the sailing hulls under their rig lines. */
  sailFill: Fill;
  sailStroke: Paint;
  /** Mirror of the hull in the sea, 0 (none) .. 1; `ripple` breaks it up. */
  reflection: number;
  ripple?: boolean;
  /** Plan view: the sea seen from above, and the deck outline. */
  plan: { sea: Fill; fill: Fill; stroke: string };
  /** Bearing view: the hull hint's silhouette and the opt-in seascape. */
  bearing: { hintFill: Fill; hintStroke: string; seaNear: string; seaFar: string; horizon: string };
}

const painted: HullStyle = {
  id: 'painted',
  name: 'Painted',
  note: 'Soft gradient fills on hull and sails, a dusk sky, the hull mirrored in the sea.',
  sky: {
    stops: [
      [0, '#08142a'],
      [0.75, '#1a3358'],
      [1, '#2c4a74'],
    ],
  },
  sea: {
    stops: [
      [0, '#1b365a'],
      [1, '#050c18'],
    ],
  },
  waterline: '#5a7aa6',
  hullFill: {
    stops: [
      [0, '#4a6e9c'],
      [0.55, '#253f63'],
      [1, '#121f35'],
    ],
  },
  hullStroke: '#7f9cc6',
  rig: '#8aa0c2',
  sailFill: {
    stops: [
      [0, '#b4c2d6', 0.92],
      [1, '#5f7290', 0.85],
    ],
    across: true,
  },
  sailStroke: '#c5d1e2',
  reflection: 0.32,
  ripple: true,
  plan: {
    sea: '#0d1d36',
    fill: {
      stops: [
        [0, '#2a4468'],
        [0.5, '#4a6e9c'],
        [1, '#2a4468'],
      ],
      across: true,
    },
    stroke: '#7f9cc6',
  },
  bearing: {
    hintFill: {
      stops: [
        [0, '#4a6e9c'],
        [1, '#1a2c48'],
      ],
    },
    hintStroke: '#7f9cc6',
    seaNear: '#16304f',
    seaFar: '#050c18',
    horizon: '#3b5a84',
  },
};

const plateHatch = { ground: '#24364c', ink: '#5d7896', gap: 4, angle: 45, width: 0.8 };

const plate: HullStyle = {
  id: 'plate',
  name: 'Technical plate',
  note: 'Clean flat fills, engraved hatching and crisp ink lines: the pilot-book look.',
  sky: '#141f2c',
  sea: { hatch: { ground: '#0f1823', ink: '#1d2b3b', gap: 6, angle: 0, width: 1 } },
  waterline: '#9fb2c6',
  hullFill: { hatch: plateHatch },
  hullStroke: '#dbe4ee',
  rig: '#c0cedd',
  sailFill: '#2f455f',
  sailStroke: '#dbe4ee',
  reflection: 0,
  plan: { sea: '#141f2c', fill: { hatch: plateHatch }, stroke: '#dbe4ee' },
  bearing: {
    hintFill: { hatch: plateHatch },
    hintStroke: '#dbe4ee',
    seaNear: '#0f1823',
    seaFar: '#0a1119',
    horizon: '#9fb2c6',
  },
};

const moonlit: HullStyle = {
  id: 'moonlit',
  name: 'Moonlit',
  note: 'Near-silhouette: dark forms with a cold rim of moonlight, so the lights dominate.',
  sky: {
    stops: [
      [0, '#010309'],
      [1, '#0c1628'],
    ],
  },
  sea: {
    stops: [
      [0, '#0a1424'],
      [1, '#010206'],
    ],
  },
  waterline: '#24395a',
  hullFill: '#03060c',
  hullStroke: {
    stops: [
      [0, '#b4c8e6'],
      [0.6, '#5d7499'],
      [1, '#1a2840'],
    ],
    scene: true,
  },
  rig: '#3e5274',
  sailFill: {
    stops: [
      [0, '#0c1528'],
      [1, '#050912'],
    ],
    across: true,
  },
  sailStroke: {
    stops: [
      [0, '#a7bbdb'],
      [1, '#2a3a58'],
    ],
    scene: true,
  },
  reflection: 0.22,
  plan: { sea: '#02050b', fill: '#04070e', stroke: '#7088ad' },
  bearing: {
    hintFill: '#04070e',
    hintStroke: '#7f96bb',
    seaNear: '#08111f',
    seaFar: '#010206',
    horizon: '#24395a',
  },
};

/** Every style the package ships. There is no default among them: a view
 *  given no style draws the base drawing, the look it always had. */
export const hullStyles = { painted, plate, moonlit } as const;

export type HullStyleId = keyof typeof hullStyles;

export const hullStyleIds = Object.keys(hullStyles) as HullStyleId[];

// --- paint plumbing ----------------------------------------------------------

/** Scene-space extent of a `scene` gradient: masthead height to waterline. */
const SCENE_TOP = PZ(1.15);
const SCENE_BOTTOM = PZ(0);

function isHatch(f: Fill): f is Hatch {
  return typeof f === 'object' && 'hatch' in f;
}

/** The def for one paint slot, and the CSS value that refers to it. */
function paintDef(id: string, fill: Fill): { def: ReactElement | null; value: string } {
  if (typeof fill === 'string') return { def: null, value: fill };
  if (isHatch(fill)) {
    const { ground, ink, gap, angle, width } = fill.hatch;
    return {
      value: `url(#${id})`,
      def: (
        <pattern
          key={id}
          id={id}
          patternUnits="userSpaceOnUse"
          width={gap}
          height={gap}
          patternTransform={`rotate(${angle})`}
        >
          <rect width={gap} height={gap} fill={ground} />
          <line x1={0} y1={0} x2={gap} y2={0} stroke={ink} strokeWidth={width} />
        </pattern>
      ),
    };
  }
  const stops = fill.stops.map(([offset, color, opacity], i) => (
    <stop key={i} offset={offset} stopColor={color} stopOpacity={opacity} />
  ));
  const def = fill.scene ? (
    <linearGradient
      key={id}
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={0}
      y1={SCENE_TOP}
      x2={0}
      y2={SCENE_BOTTOM}
    >
      {stops}
    </linearGradient>
  ) : (
    <linearGradient
      key={id}
      id={id}
      x1={0}
      y1={0}
      x2={fill.across ? 1 : 0}
      y2={fill.across ? 0 : 1}
    >
      {stops}
    </linearGradient>
  );
  return { def, value: `url(#${id})` };
}

export type StyledView = 'profile' | 'plan' | 'bearing';

/** The <defs> a style needs in one view, and the custom properties that
 *  point the drawing at them, to set on that view's <svg>. Ids are scoped
 *  per call site, so any number of styled views can share a page. */
export function useHullStylePaint(
  style: HullStyle | undefined,
  view: StyledView,
): { defs: ReactElement | null; vars: CSSProperties | undefined; uid: string } {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!style) return { defs: null, vars: undefined, uid };
  const slots: Record<string, Fill> =
    view === 'profile'
      ? {
          '--sea-night': style.sky,
          '--sea-below': style.sea,
          '--hull-fill': style.hullFill,
          '--hull-stroke': style.hullStroke,
          '--sail-fill': style.sailFill,
          '--sail-stroke': style.sailStroke,
        }
      : view === 'plan'
        ? {
            '--sea-night': style.plan.sea,
            '--hull-fill': style.plan.fill,
          }
        : { '--hint-fill': style.bearing.hintFill };
  const defs: ReactElement[] = [];
  const vars: Record<string, string> = {};
  for (const [name, fill] of Object.entries(slots)) {
    const { def, value } = paintDef(`hs-${uid}${name.slice(1)}`, fill);
    if (def) defs.push(def);
    vars[name] = value;
  }
  if (view === 'profile') {
    vars['--waterline'] = style.waterline;
    vars['--rig-stroke'] = style.rig;
  } else if (view === 'plan') {
    vars['--hull-stroke'] = style.plan.stroke;
  } else {
    vars['--hint-stroke'] = style.bearing.hintStroke;
    vars['--bearing-sea-near'] = style.bearing.seaNear;
    vars['--bearing-sea-far'] = style.bearing.seaFar;
    vars['--bearing-horizon'] = style.bearing.horizon;
  }
  return { defs: <defs>{defs}</defs>, vars: vars as CSSProperties, uid };
}

// --- what the line drawings leave out -----------------------------------------

type Pt = [fx: number, z: number];
const at = ([fx, z]: Pt) => `${PX(fx).toFixed(1)},${PZ(z).toFixed(1)}`;

/** A fore-and-aft sail: head, tack, clew, with the leech bellied out. */
function triSail(head: Pt, tack: Pt, clew: Pt, belly: Pt): string {
  return `M${at(head)} L${at(tack)} L${at(clew)} Q${at(belly)} ${at(head)} Z`;
}

/** Sails for the hulls whose drawing carries a rig but no canvas, in that
 *  drawing's own coordinates (see sailSmall and squareRigger in hulls.tsx). */
const SAILS: Record<string, () => string[]> = {
  // Bermudan sloop: mainsail on the boom, jib on the forestay.
  'sail-small': () => [
    triSail([0.13, 0.87], [0.13, 0.41], [-0.58, 0.37], [-0.12, 0.7]),
    triSail([0.15, 0.83], [0.86, 0.22], [0.2, 0.31], [0.44, 0.38]),
  ],
  // The same drawing at a longer length.
  'sail-large': () => SAILS['sail-small']!(),
  // Three masts of square sails, one between each pair of yards, and a
  // headsail on the fore stay.
  'square-rigger': () => {
    const out: string[] = [];
    const yards = [0.48, 0.66, 0.82];
    for (const [fx, top] of [
      [0.5, 1.0],
      [-0.05, 1.1],
      [-0.55, 0.9],
    ] as const) {
      const half = (z: number) => (22 * (1 - (z - 0.4) / top)) / 185;
      const zs = [...yards.filter((z) => z < top), Math.min(top - 0.06, 0.96)];
      for (let i = 0; i + 1 < zs.length; i++) {
        const lo = zs[i]!;
        const hi = zs[i + 1]!;
        const sag = (hi - lo) * 0.18;
        out.push(
          `M${at([fx - half(hi), hi])} L${at([fx + half(hi), hi])} ` +
            `L${at([fx + half(lo), lo + 0.01])} ` +
            `Q${at([fx, lo - sag])} ${at([fx - half(lo), lo + 0.01])} Z`,
        );
      }
    }
    out.push(triSail([0.52, 0.94], [1.0, 0.43], [0.62, 0.5], [0.8, 0.62]));
    return out;
  },
};

/** Whether a style draws sails on this hull. */
export function hasSails(hull: Hull): boolean {
  return hull.spec.id in SAILS;
}

function Sails({ hull }: { hull: Hull }): ReactElement | null {
  const paths = SAILS[hull.spec.id]?.();
  if (!paths) return null;
  return (
    <g className="hull-sails">
      {paths.map((p, i) => (
        <path
          key={i}
          d={p}
          fill="var(--sail-fill)"
          stroke="var(--sail-stroke)"
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

/** The hull in a style, for the profile view: sails under the rig, the
 *  base drawing itself untouched, and a reflection in the sea below. */
export function StyledProfile({
  hull,
  style,
  uid,
}: {
  hull: Hull;
  style: HullStyle;
  uid: string;
}): ReactElement {
  const clip = `hs-${uid}-below`;
  const fade = `hs-${uid}-fade`;
  const fadeGrad = `hs-${uid}-fadegrad`;
  const ripple = `hs-${uid}-ripple`;
  const W = PZ(0);
  const boat = (
    <>
      <Sails hull={hull} />
      <hull.Profile />
    </>
  );
  return (
    <g className={`hull-style hull-style-${style.id}`}>
      {style.reflection > 0 && (
        <>
          <defs>
            <clipPath id={clip}>
              <rect x={0} y={W} width={440} height={240 - W} />
            </clipPath>
            <linearGradient
              id={fadeGrad}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={W}
              x2={0}
              y2={240}
            >
              <stop offset={0} stopColor="#fff" />
              <stop offset={0.7} stopColor="#000" />
            </linearGradient>
            <mask id={fade} maskUnits="userSpaceOnUse" x={0} y={0} width={440} height={240}>
              <rect x={0} y={W} width={440} height={240 - W} fill={`url(#${fadeGrad})`} />
            </mask>
            {style.ripple && (
              <filter id={ripple} x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.012 0.18"
                  numOctaves={2}
                  seed={3}
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  scale={6}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            )}
          </defs>
          <g
            className="hull-reflection"
            clipPath={`url(#${clip})`}
            mask={`url(#${fade})`}
            opacity={style.reflection}
          >
            <g filter={style.ripple ? `url(#${ripple})` : undefined}>
              <g transform={`matrix(1 0 0 -1 0 ${2 * W})`}>{boat}</g>
            </g>
          </g>
        </>
      )}
      {boat}
    </g>
  );
}
