// Top-down arc sectors: each light's from/to bearing drawn around the
// hull, read like a chart inset. A relative-bearing rose rings the hull,
// the 112.5° and 247.5° lines (22.5° abaft the beam) are labelled, each
// sector names its lights on hover or focus, and the viewer's θ is a
// sightline the arrow keys move round the rose.

import { useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { Hull } from './hulls.js';
import type { PlacedLight } from './placement.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { bearingLabel } from './bearing.js';
import { Glow, lightFill, polar, sectorPath } from './svg.js';
import type { HullStyle } from './hullStyles.js';
import { useHullStylePaint } from './hullStyles.js';
import type { PlacedShape } from './shapes.js';
import { PlanShapes } from './shapeMarks.js';
import { thetaForKey } from './ThetaControl.js';
import { wrapDegrees } from './rotate.js';

/** Canvas side; the hull sits at its centre. */
const SIZE = 520;
const C = SIZE / 2;
const HULL_SCALE = 62;
/** The rose: its ring, its ticks inside the ring, its numbers outside. */
const ROSE_R = 196;
const ROSE_NUM_R = 208;
const RING_R0 = 84;
const RING_STEP = 13;
const RING_W = 11;
/** The lines where the sidelights and masthead light cut off, and dead ahead. */
const CUTOFFS = [112.5, 247.5] as const;

/** Degrees moved by an arrow key with Shift held. */
export const PLAN_THETA_SHIFT_STEP = 10;

/** θ for a key pressed on the plan's rose, or null if the key is not one it uses.
 *  Right and Up turn clockwise, Left and Down anticlockwise, one degree a
 *  press, ten with Shift; Home, End, PageUp and PageDown as on the dial. */
export function planThetaForKey(theta: number, key: string, shift = false): number | null {
  const t = Math.round(theta);
  const step = shift ? PLAN_THETA_SHIFT_STEP : 1;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp':
      return wrapDegrees(t + step);
    case 'ArrowLeft':
    case 'ArrowDown':
      return wrapDegrees(t - step);
    default:
      return thetaForKey(t, key);
  }
}

const three = (b: number) => String(b).padStart(3, '0');

interface Ring {
  key: string;
  color: string;
  from: number;
  to: number;
  names: string;
}

/** One ring per distinct colour and arc, in first-seen order; a ring names every light on it. */
export function planRings(placed: PlacedLight[]): Ring[] {
  const rings: Ring[] = [];
  const names = new Map<string, string[]>();
  for (const l of placed) {
    if (l.arc === null) continue;
    const k = `${l.color}:${l.arc.from_deg}:${l.arc.to_deg}`;
    const name = `${l.color} ${l.name ?? l.lightId.replace(/^light:/, '').replace(/_/g, ' ')}`;
    if (!names.has(k)) {
      names.set(k, []);
      rings.push({ key: k, color: l.color, from: l.arc.from_deg, to: l.arc.to_deg, names: '' });
    }
    const list = names.get(k)!;
    if (!list.includes(name)) list.push(name);
  }
  for (const r of rings) r.names = names.get(r.key)!.join(', ');
  return rings;
}

export function PlanView({
  hull,
  placed,
  theta,
  onTheta,
  labels = defaultSceneLabels,
  style,
  time = 'night',
  shapes,
}: {
  hull: Hull;
  placed: PlacedLight[];
  theta: number;
  onTheta: (t: number) => void;
  labels?: SceneLabels;
  /** Paint the deck outline in one of `hullStyles`. Default: the base look. */
  style?: HullStyle;
  /** `day` switches the ground to daylight, hides the light arcs and draws `shapes`. Default: night. */
  time?: 'day' | 'night';
  /** Day shapes from `placeShapes`, marked at their positions when `time` is `day`. */
  shapes?: PlacedShape[];
}): ReactElement {
  const day = time === 'day';
  const paint = useHullStylePaint(style, 'plan', time);
  const [active, setActive] = useState<string | null>(null);
  const t = Math.round(wrapDegrees(theta)) % 360;
  const abaftBeam = labels.planAbaftBeam ?? defaultSceneLabels.planAbaftBeam!;
  const rose = labels.planRose ?? defaultSceneLabels.planRose!;
  const sectorName = labels.planSector ?? defaultSceneLabels.planSector!;
  const aspect = labels.aspect[bearingLabel(t)];

  const arcLights = day ? [] : placed.filter((l) => l.arc !== null);
  const rings = planRings(arcLights);
  const ringKeyOf = (l: PlacedLight) => `${l.color}:${l.arc!.from_deg}:${l.arc!.to_deg}`;
  const activeRing = rings.find((r) => r.key === active) ?? null;

  const hullPath =
    hull.plan
      .map(([fx, py], i) => `${i === 0 ? 'M' : 'L'}${C + py * HULL_SCALE},${C - fx * HULL_SCALE}`)
      .join(' ') + ' Z';

  const setFromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - C;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - C;
    const deg = (Math.atan2(x, -y) * 180) / Math.PI;
    onTheta(Math.round((deg + 360) % 360));
  };

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const next = planThetaForKey(t, e.key, e.shiftKey);
    if (next === null) return;
    e.preventDefault();
    onTheta(next);
  };

  const ticks: ReactElement[] = [];
  for (let b = 0; b < 360; b += 5) {
    const major = b % 45 === 0;
    const mid = b % 10 === 0;
    const [x1, y1] = polar(C, C, ROSE_R - (major ? 12 : mid ? 7 : 4), b);
    const [x2, y2] = polar(C, C, ROSE_R, b);
    ticks.push(
      <line
        key={b}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--accent-soft)"
        strokeOpacity={major ? 0.9 : 0.5}
        strokeWidth={major ? 1.4 : 1}
      />,
    );
  }
  const numbers = [];
  for (let b = 0; b < 360; b += 30) {
    const [x, y] = polar(C, C, ROSE_NUM_R, b);
    numbers.push(
      <text
        key={b}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fill="var(--accent-soft)"
      >
        {three(b)}
      </text>,
    );
  }
  const words: [number, string][] = [
    [0, rose.ahead],
    [90, rose.starboard],
    [180, rose.astern],
    [270, rose.port],
  ];

  const [ex, ey] = polar(C, C, ROSE_R, t);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="group"
      aria-label={labels.planAlt}
      className="scene-svg plan-svg"
      style={paint.vars}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) setFromPointer(e);
      }}
    >
      {paint.defs}
      <rect width={SIZE} height={SIZE} fill="var(--sea-night)" />

      {/* the relative-bearing rose: a slider for θ */}
      <g
        className="plan-rose"
        role="slider"
        tabIndex={0}
        aria-label={labels.bearingThetaLabel}
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={t}
        aria-valuetext={labels.bearingThetaValue(t, aspect)}
        onKeyDown={onKeyDown}
      >
        <circle
          cx={C}
          cy={C}
          r={ROSE_R}
          fill="none"
          stroke="var(--accent-soft)"
          strokeOpacity={0.6}
        />
        {ticks}
        {numbers}
        {words.map(([b, w]) => {
          const [x, y] = polar(C, C, ROSE_R - 22, b);
          return (
            <text
              key={b}
              x={x}
              y={y}
              textAnchor={b === 90 ? 'end' : b === 270 ? 'start' : 'middle'}
              dominantBaseline="central"
              fontSize={9}
              fill="var(--accent-soft)"
              fillOpacity={0.7}
            >
              {w}
            </text>
          );
        })}
      </g>

      {rings.map((r, i) => {
        const r0 = RING_R0 + i * RING_STEP;
        const lit = active === null || active === r.key;
        const [ax0, ay0] = polar(C, C, r0, r.from);
        const [ax1, ay1] = polar(C, C, r0 + RING_W, r.from);
        const [bx0, by0] = polar(C, C, r0, r.to);
        const [bx1, by1] = polar(C, C, r0 + RING_W, r.to);
        const full = (r.to - r.from + 360) % 360 === 0;
        const name = sectorName(r.names, r.from, r.to);
        return (
          <g
            key={r.key}
            className="plan-sector"
            role="img"
            tabIndex={0}
            aria-label={name}
            onPointerEnter={() => setActive(r.key)}
            onPointerLeave={() => setActive((a) => (a === r.key ? null : a))}
            onFocus={() => setActive(r.key)}
            onBlur={() => setActive((a) => (a === r.key ? null : a))}
          >
            <title>{name}</title>
            <path
              d={sectorPath(C, C, r0, r0 + RING_W, r.from, r.to)}
              fill={lightFill(r.color)}
              opacity={active === r.key ? 0.62 : lit ? 0.3 : 0.12}
              stroke={lightFill(r.color)}
              strokeOpacity={lit ? 0.8 : 0.3}
              strokeWidth={active === r.key ? 1.6 : 1}
            />
            {/* the sector's edges, so overlapping rings read where each starts and stops */}
            {!full && (
              <>
                <line
                  x1={ax0}
                  y1={ay0}
                  x2={ax1}
                  y2={ay1}
                  stroke={lightFill(r.color)}
                  strokeOpacity={lit ? 1 : 0.35}
                  strokeWidth={2}
                />
                <line
                  x1={bx0}
                  y1={by0}
                  x2={bx1}
                  y2={by1}
                  stroke={lightFill(r.color)}
                  strokeOpacity={lit ? 1 : 0.35}
                  strokeWidth={2}
                />
              </>
            )}
          </g>
        );
      })}

      {/* dead ahead, and the 112.5° / 247.5° lines: 22.5° abaft the beam */}
      <line
        x1={C}
        y1={C - 74}
        x2={C}
        y2={C - (ROSE_R - 12)}
        stroke="var(--grid-line)"
        strokeWidth={1}
        strokeDasharray="2 5"
      />
      {CUTOFFS.map((b) => {
        const [x1, y1] = polar(C, C, 74, b);
        const [x2, y2] = polar(C, C, ROSE_R + 30, b);
        const starboard = b < 180;
        const lx = starboard ? SIZE - 8 : 8;
        return (
          <g key={b} className="plan-cutoff">
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--accent-soft)"
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={lx}
              y={y2 + 22}
              textAnchor={starboard ? 'end' : 'start'}
              fontSize={11}
              fontWeight={600}
              fill="var(--accent-soft)"
            >
              {`${b}°`}
            </text>
            <text
              x={lx}
              y={y2 + 35}
              textAnchor={starboard ? 'end' : 'start'}
              fontSize={9.5}
              fill="var(--accent-soft)"
              fillOpacity={0.8}
            >
              {abaftBeam}
            </text>
          </g>
        );
      })}

      <path d={hullPath} fill="var(--hull-fill)" stroke="var(--hull-stroke)" strokeWidth={1.5} />
      {/* lights at their true positions on the hull */}
      {arcLights.map((l) => (
        <Glow
          key={l.key}
          x={C + l.py * HULL_SCALE}
          y={C - l.fx * HULL_SCALE}
          color={l.color}
          r={active === ringKeyOf(l) ? 5 : 3.2}
          flashing={l.character === 'flashing'}
        />
      ))}
      {day && shapes && (
        <PlanShapes
          shapes={shapes}
          center={C}
          hullScale={HULL_SCALE}
          legendLabel={labels.planShapesAlt ?? 'Day shapes'}
        />
      )}

      {/* the viewer's sightline: from the eye on the rose to the vessel */}
      <g className="plan-sightline" aria-hidden="true">
        <line
          x1={ex}
          y1={ey}
          x2={C}
          y2={C}
          stroke="var(--accent-soft)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <circle
          cx={ex}
          cy={ey}
          r={7}
          fill="var(--sea-night)"
          stroke="var(--accent-soft)"
          strokeWidth={1.5}
        />
        <circle cx={ex} cy={ey} r={2.4} fill="var(--accent-soft)" />
      </g>
      <text x={10} y={22} fontSize={14} fontWeight={600} fill="var(--accent-soft)">
        {`θ ${three(t)}°`}
      </text>
      <text x={10} y={38} fontSize={10} fill="var(--accent-soft)" fillOpacity={0.8}>
        {aspect}
      </text>
      {activeRing && (
        <text
          className="plan-sector-name"
          x={10}
          y={SIZE - 12}
          fontSize={11}
          fill="var(--accent-soft)"
        >
          {sectorName(activeRing.names, activeRing.from, activeRing.to)}
        </text>
      )}
    </svg>
  );
}
