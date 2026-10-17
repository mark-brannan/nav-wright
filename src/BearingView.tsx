// The exam-critical view: lights only, on black, seen from relative
// bearing theta. Sidelight cutoffs and masthead arc edges happen live as
// theta sweeps — arcs come straight from lights.json via placement.
// The night seascape (horizon, sea, hull hint) is an opt-in extra, kept in
// its own block at the bottom of this file.

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
  /** Background, 0 (black, the exam default) .. 1 (a lighter night blue). See skyColor. */
  sky?: number;
  /** Opt-in night seascape: a horizon and a sea under the lights. Default: lights only on black. */
  seascape?: boolean;
  /** Draw a combined fixture (tricolor) as one lantern in the colour facing the viewer. Default off: one dot per sector. */
  singleLantern?: boolean;
  /** Scale each glow by the light's range (`lightRangesNm`, by lightId) and the viewing `range`. Default off: every glow alike. */
  rangeGlow?: boolean;
  /** Rule 22 range in nautical miles by lightId, from lights.json visibility. Used by rangeGlow. */
  lightRangesNm?: Record<string, number>;
  /** Flash rate in flashes per minute for flashing lights (see declaredFlashRate). Default: the stylesheet's cycle. */
  flashesPerMinute?: number;
  labels?: SceneLabels;
  /** Paint the hull hint and seascape in one of `hullStyles`. Default: the base look. Lights and sky are the same in every style. */
  style?: HullStyle;
};

export function BearingView(props: BearingSceneProps): ReactElement {
  const { hull, theta, onTheta, labels = defaultSceneLabels } = props;
  return (
    <div className="bearing-view">
      <BearingScene {...props} />
      <ThetaControl theta={theta} onTheta={onTheta} labels={labels} plan={hull.plan} />
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
  singleLantern = false,
  rangeGlow = false,
  lightRangesNm,
  flashesPerMinute,
  labels = defaultSceneLabels,
  style,
}: BearingSceneProps): ReactElement {
  const drag = useDragRotate<SVGSVGElement>(theta, onTheta);
  const paint = useHullStylePaint(style, 'bearing');
  const rad = (theta * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  const visible = lightsInView(placed, theta);
  const projected = (singleLantern ? mergeLanterns(visible, theta) : visible).map((l) => ({
    light: l,
    x: CX + (l.fx * sin - l.py * cos) * SCALE,
    y: HORIZON - l.z * ZSCALE,
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
      <rect className="bearing-sky" width="440" height="240" fill={skyColor(sky)} />
      {seascape && <Seascape />}
      {hullHint > 0 && (
        <HullHint hull={hull} theta={theta} range={range} strength={hullHint} styled={!!style} />
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
          r={5.5}
        />
      ))}
      {projected.length === 0 && (
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

/** The sky at full brightness: a lighter night blue. Black is brightness 0. */
export const SKY_LIGHT: readonly [number, number, number] = [0x3a, 0x65, 0x93];

/** Background colour for a sky brightness 0..1 (clamped): black to SKY_LIGHT. */
export function skyColor(brightness: number): string {
  const t = Number.isFinite(brightness) ? Math.min(1, Math.max(0, brightness)) : 0;
  return `#${SKY_LIGHT.map((c) =>
    Math.round(c * t)
      .toString(16)
      .padStart(2, '0'),
  ).join('')}`;
}

/** The sea at full brightness: a blue-gray. Black is brightness 0. */
export const SEA_LIGHT: readonly [number, number, number] = [0x3c, 0x55, 0x6e];

/** Sea colour for a brightness 0..1 (clamped): black to SEA_LIGHT. */
export function seaColor(brightness: number): string {
  const t = Number.isFinite(brightness) ? Math.min(1, Math.max(0, brightness)) : 0;
  return `#${SEA_LIGHT.map((c) =>
    Math.round(c * t)
      .toString(16)
      .padStart(2, '0'),
  ).join('')}`;
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

function Seascape(): ReactElement {
  const id = `${useId()}-sea`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bearing-sea-near, #0a1424)" />
          <stop offset="1" stopColor="var(--bearing-sea-far, #03060b)" />
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
