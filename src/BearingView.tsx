// The exam-critical view: lights only, on black, seen from relative
// bearing theta. Sidelight cutoffs and masthead arc edges happen live as
// theta sweeps — arcs come straight from lights.json via placement. With a
// sectorProfile the edges soften per Annex I §9(a) (sectorProfile.ts), the
// same profile the 3D view draws; without one, the exam's hard cut.
// The night seascape (horizon, sea, hull hint) is an opt-in extra, kept in
// its own block at the bottom of this file. `time="day"` swaps in the day
// palette: a daylit sky and sea, the hull plain to see, the lights unlit.

import { useId } from 'react';
import type { ReactElement } from 'react';
import type { Hull } from './hulls.js';
import type { PlacedLight } from './placement.js';
import { lightsInView } from './placement.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { ThetaControl } from './ThetaControl.js';
import { useDragRotate } from './rotate.js';
import { mergeLanterns } from './lantern.js';
import { Glow, glowProfile } from './svg.js';
import type { SectorProfile } from './sectorProfile.js';
import { sectorIntensity } from './sectorProfile.js';
import type { HullStyle } from './hullStyles.js';
import { useHullStylePaint } from './hullStyles.js';

const CX = 220;
const HORIZON = 150;
const SCALE = 150;
const ZSCALE = 95;

type BearingSceneProps = {
  hull: Hull;
  placed: PlacedLight[];
  theta: number;
  onTheta: (t: number) => void;
  /** Hull hint strength, 0 (off) .. 1 (plain to see); range fades it further. */
  hullHint: number;
  /** Range to her in nautical miles; fades the hull hint (see hullHintOpacity). */
  range?: number;
  /** Background, 0 (black, the exam default) .. 1 (a lighter night blue); by
   *  day, 0 (overcast) .. 1 (clear). See skyColor. */
  sky?: number;
  /** Opt-in night seascape: a horizon and a sea under the lights. Default: lights only on black. */
  seascape?: boolean;
  /** The seascape's sea, 0 (black) .. 1 (deep navy); by day, 0 (grey) .. 1
   *  (daylit blue). The same scale as BearingModelView's `sea`; see seaColor.
   *  Default: the style's own night sea, or the day sea at 1 by day. */
  sea?: number;
  /** `day` draws the day palette: the sky and sea by daylight, the hull at
   *  full strength whatever `hullHint` and `range`, and no light lit
   *  (Rule 20(b)). Default: night. */
  time?: 'day' | 'night';
  /** Draw a combined fixture (tricolor) as one lantern in the colour facing the viewer. Default off: one dot per sector. */
  singleLantern?: boolean;
  /** Scale each glow by the light's range (`lightRangesNm`, by lightId) and the viewing `range`. Default off: every glow alike. */
  rangeGlow?: boolean;
  /** Rule 22 range in nautical miles by lightId, from lights.json visibility. Used by rangeGlow. */
  lightRangesNm?: Record<string, number>;
  /** Annex I §9(a) edge profiles (see sectorProfile.ts, ANNEX_I_PROFILE): each
   *  light fades across its arc limits instead of cutting hard. Default: the
   *  hard cut, in arc or not. */
  sectorProfile?: SectorProfile;
  /** Flash rate in flashes per minute for flashing lights (see declaredFlashRate). Default: the stylesheet's cycle. */
  flashesPerMinute?: number;
  labels?: SceneLabels;
  /** Paint the hull hint and seascape in one of `hullStyles`. Default: the base look. Lights and sky are the same in every style. */
  style?: HullStyle;
};

export function BearingView({
  controls = true,
  ...props
}: BearingSceneProps & {
  /** Draw the dial under the picture. False when the page places one itself. */
  controls?: boolean;
}): ReactElement {
  const { hull, theta, onTheta, labels = defaultSceneLabels } = props;
  return (
    <div className="bearing-view">
      <BearingScene {...props} />
      {controls && (
        <ThetaControl theta={theta} onTheta={onTheta} labels={labels} plan={hull.plan} />
      )}
    </div>
  );
}

/** The bearing view's picture without its dial: what the 3D bearing view
 *  shows while three.js and the model load. */
export function BearingScene({
  hull,
  placed,
  theta,
  onTheta,
  hullHint,
  range,
  sky = 0,
  seascape = false,
  sea,
  time = 'night',
  singleLantern = false,
  rangeGlow = false,
  lightRangesNm,
  sectorProfile,
  flashesPerMinute,
  labels = defaultSceneLabels,
  style,
}: BearingSceneProps): ReactElement {
  const drag = useDragRotate<SVGSVGElement>(theta, onTheta);
  const day = time === 'day';
  const paint = useHullStylePaint(style, 'bearing');
  const rad = (theta * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const visible: (PlacedLight & { intensity?: number })[] = sectorProfile
    ? placed
        .map((l) => ({ ...l, intensity: sectorIntensity(theta, l.arc, sectorProfile) }))
        .filter((l) => l.intensity > 0)
    : lightsInView(placed, theta);
  const projected = day
    ? []
    : (singleLantern ? mergeLanterns(visible, theta) : visible).map((l) => ({
        light: l,
        x: CX + (l.fx * sin - l.py * cos) * SCALE,
        y: HORIZON - l.z * ZSCALE,
        intensity: l.intensity ?? 1,
      }));

  return (
    <svg
      viewBox="0 0 440 240"
      role="img"
      aria-label={labels.bearingAlt(Math.round(theta))}
      className="scene-svg scene-svg-black"
      style={{ touchAction: 'pan-y', cursor: 'grab', ...paint.vars }}
      {...drag}
    >
      {paint.defs}
      <rect className="bearing-sky" width="440" height="240" fill={skyColor(sky, time)} />
      {seascape && (
        <Seascape
          sea={sea === undefined && !day ? undefined : seaColor(sea ?? 1, time)}
          far={sea === undefined && !day ? undefined : seaColor((sea ?? 1) * SEA_FAR, time)}
        />
      )}
      {(day || hullHint > 0) && (
        <HullHint
          hull={hull}
          theta={theta}
          range={day ? undefined : range}
          strength={day ? 1 : hullHint}
          styled={!!style}
        />
      )}
      {projected.map((p) => (
        <Glow
          key={p.light.key}
          x={p.x}
          y={p.y}
          color={p.light.color}
          flashing={p.light.character === 'flashing'}
          flashesPerMinute={flashesPerMinute}
          glow={rangeGlow ? glowProfile(lightRangesNm?.[p.light.lightId], range) : undefined}
          intensity={p.intensity}
          r={5.5}
        />
      ))}
      {!day && projected.length === 0 && (
        <text x="220" y="120" textAnchor="middle" className="bearing-empty">
          {labels.bearingNoLights}
        </text>
      )}
    </svg>
  );
}

// --- seascape (opt-in) ------------------------------------------------------
// Everything that turns the lights-only view into a night at sea lives in
// this block: the sky, the horizon, the sea, and the range-faded hull
// silhouette. The sky is black unless the viewer lifts it, so the lights stay
// the only spectacle by default. BearingView above only decides whether to
// mount these.

type Rgb = readonly [number, number, number];

/** The sky at full brightness: a lighter night blue. Black is brightness 0. */
export const SKY_LIGHT: Rgb = [0x3a, 0x65, 0x93];
/** The day sky: overcast at brightness 0, clear at 1 (the profile view's --sky-day). */
export const DAY_SKY_DULL: Rgb = [0x9a, 0xa6, 0xb0];
export const DAY_SKY_CLEAR: Rgb = [0xcf, 0xe6, 0xf7];

/** The sea at full brightness: a deep navy. Black is brightness 0. */
export const SEA_LIGHT: Rgb = [0x16, 0x38, 0x78];
/** The day sea: grey at brightness 0, daylit blue at 1 (the profile view's --sea-day). */
export const DAY_SEA_DULL: Rgb = [0x45, 0x58, 0x63];
export const DAY_SEA_LIT: Rgb = [0x5f, 0x93, 0xb8];

/** The seascape's foreground sea, as a fraction of its brightness at the horizon. */
const SEA_FAR = 0.4;

const BLACK: Rgb = [0, 0, 0];

function mix(from: Rgb, to: Rgb, brightness: number): string {
  const t = Number.isFinite(brightness) ? Math.min(1, Math.max(0, brightness)) : 0;
  return `#${from
    .map((c, i) =>
      Math.round(c + (to[i]! - c) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Background colour for a sky brightness 0..1 (clamped): by night black to
 *  SKY_LIGHT, by day DAY_SKY_DULL to DAY_SKY_CLEAR. */
export function skyColor(brightness: number, time: 'day' | 'night' = 'night'): string {
  return time === 'day'
    ? mix(DAY_SKY_DULL, DAY_SKY_CLEAR, brightness)
    : mix(BLACK, SKY_LIGHT, brightness);
}

/** Sea colour for a brightness 0..1 (clamped): by night black to SEA_LIGHT,
 *  by day DAY_SEA_DULL to DAY_SEA_LIT. */
export function seaColor(brightness: number, time: 'day' | 'night' = 'night'): string {
  return time === 'day'
    ? mix(DAY_SEA_DULL, DAY_SEA_LIT, brightness)
    : mix(BLACK, SEA_LIGHT, brightness);
}

/** Moonlight reaches this far: the hull hint is at full strength here and nearer. */
export const HULL_HINT_NEAR_NM = 0.5;
/** ... and is gone by this range. */
export const HULL_HINT_FAR_NM = 3;

/** Hull hint opacity for a range in nautical miles: 1 at 0.5 nm and nearer,
 *  falling linearly to 0 at 3 nm and beyond. No range given: full strength. */
export function hullHintOpacity(rangeNm?: number): number {
  if (rangeNm === undefined || Number.isNaN(rangeNm)) return 1;
  const t = (HULL_HINT_FAR_NM - rangeNm) / (HULL_HINT_FAR_NM - HULL_HINT_NEAR_NM);
  return Math.min(1, Math.max(0, t));
}

/** The hull's silhouette as seen from relative bearing theta, in the view's
 *  coordinates, standing on the waterline (y = HORIZON). The plan outline
 *  projects to a horizontal extent: her length abeam, her beam end-on. The
 *  bow end rakes in proportion to how far abeam she is, so the shape reads
 *  as bow or stern before any light is read. */
export function hullSilhouette(hull: Hull, theta: number): [number, number][] {
  const rad = (theta * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const xs = hull.plan.map(([fx, py]) => CX + (fx * sin - py * cos) * SCALE);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const height = hull.spec.sideLightZ * ZSCALE * 0.8;
  const extent = maxX - minX;
  const tuck = Math.min(extent * 0.1, height * 0.4);
  const rake = Math.min(extent * 0.25, height * 1.2) * Math.abs(sin);
  const bowRight = sin >= 0;
  const left = tuck + (bowRight ? 0 : rake);
  const right = tuck + (bowRight ? rake : 0);
  const top = HORIZON - height;
  return [
    [minX, HORIZON],
    [minX + left, top],
    [maxX - right, top],
    [maxX, HORIZON],
  ];
}

/** The sea and horizon. `sea` and `far` colour it at the horizon and in the
 *  foreground; undefined keeps the style's own night sea. */
function Seascape({ sea, far }: { sea?: string; far?: string }): ReactElement {
  const id = `${useId()}-sea`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sea ?? 'var(--bearing-sea-near, #0a1424)'} />
          <stop offset="1" stopColor={far ?? 'var(--bearing-sea-far, #03060b)'} />
        </linearGradient>
      </defs>
      <rect
        className="bearing-sea"
        x="0"
        y={HORIZON}
        width="440"
        height={240 - HORIZON}
        fill={`url(#${id})`}
      />
      <line
        className="bearing-horizon"
        x1="0"
        y1={HORIZON}
        x2="440"
        y2={HORIZON}
        stroke="var(--bearing-horizon, #1b2a42)"
        strokeWidth={1}
      />
    </>
  );
}

function HullHint({
  hull,
  theta,
  range,
  strength,
  styled,
}: {
  hull: Hull;
  theta: number;
  range?: number;
  strength: number;
  styled: boolean;
}): ReactElement | null {
  const opacity = Math.min(1, strength) * hullHintOpacity(range);
  if (opacity <= 0) return null;
  const d = hullSilhouette(hull, theta)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  return (
    <path
      className="bearing-hull-hint"
      d={`${d} Z`}
      fill={styled ? 'var(--hint-fill)' : '#3a4a60'}
      stroke={styled ? 'var(--hint-stroke)' : '#607898'}
      strokeWidth={1}
      opacity={opacity.toFixed(3)}
    />
  );
}
// --- end seascape -----------------------------------------------------------
