// Two vessels in one north-up plan frame: own ship and a target placed from
// their relative bearing and range, each with its arcs, plus the line of
// bearing between them. Composition only; it draws no verdict.

import type { ReactElement } from 'react';
import type { Hull } from './hulls.js';
import type { PlacedLight } from './placement.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { fitScale, pairLayout, toScreen } from './sceneGeometry.js';
import { Glow, lightFill, sectorPath } from './svg.js';

export interface SceneVessel {
  hull: Hull;
  placed: PlacedLight[];
  /** true heading, deg */
  heading: number;
  /** speed over ground, m/s; with it the scene draws the vessel's vector */
  speedMps?: number;
  /** course over ground, true deg; defaults to the heading */
  courseDeg?: number;
}

/** East/north metres a vessel covers in `seconds` at its course and speed. */
function travel(v: SceneVessel, seconds: number): { east: number; north: number } {
  const a = (((v.courseDeg ?? v.heading) % 360) * Math.PI) / 180;
  const d = (v.speedMps ?? 0) * seconds;
  return { east: d * Math.sin(a), north: d * Math.cos(a) };
}

const SIZE = 440;
const HULL_PX = 34; // half-length of a drawn hull, px
const RING_GAP_PX = 6; // hull to first ring
const RING_STEP_PX = 5;
const RING_WIDTH_PX = 4;

/** One ring per distinct arc+colour, the way PlanView stacks them. */
function ringsOf(placed: PlacedLight[]): PlacedLight[] {
  const seen = new Set<string>();
  return placed.filter((l) => {
    if (l.arc === null) return false;
    const k = `${l.color}:${l.arc.from_deg}:${l.arc.to_deg}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Radius, px, that the hull and its outermost ring reach from the vessel's centre. */
function reachPx(v: SceneVessel): number {
  const n = ringsOf(v.placed).length;
  return n === 0 ? HULL_PX : HULL_PX + RING_GAP_PX + (n - 1) * RING_STEP_PX + RING_WIDTH_PX;
}

function Vessel({
  v,
  x,
  y,
  id,
}: {
  v: SceneVessel;
  x: number;
  y: number;
  id: string;
}): ReactElement {
  const arcLights = v.placed.filter((l) => l.arc !== null);
  const rings = ringsOf(v.placed);
  const hullPath =
    v.hull.plan
      .map(([fx, py], i) => `${i === 0 ? 'M' : 'L'}${py * HULL_PX},${-fx * HULL_PX}`)
      .join(' ') + ' Z';
  return (
    <g data-vessel={id} transform={`translate(${x} ${y}) rotate(${v.heading})`}>
      {rings.map((l, i) => (
        <path
          key={l.key}
          d={sectorPath(
            0,
            0,
            HULL_PX + RING_GAP_PX + i * RING_STEP_PX,
            HULL_PX + RING_GAP_PX + i * RING_STEP_PX + RING_WIDTH_PX,
            l.arc!.from_deg,
            l.arc!.to_deg,
          )}
          fill={lightFill(l.color)}
          opacity={0.35}
        />
      ))}
      <path d={hullPath} fill="var(--hull-fill)" stroke="var(--hull-stroke)" strokeWidth={1.2} />
      {arcLights.map((l) => (
        <Glow
          key={l.key}
          x={l.py * HULL_PX}
          y={-l.fx * HULL_PX}
          color={l.color}
          r={2.2}
          flashing={l.character === 'flashing'}
        />
      ))}
    </g>
  );
}

export function SceneView({
  own,
  target,
  relativeBearing,
  rangeM,
  vectorMinutes = 6,
  cpa,
  labels = defaultSceneLabels,
}: {
  own: SceneVessel;
  target: SceneVessel;
  /** target's bearing from own ship, relative to own bow, deg */
  relativeBearing: number;
  rangeM: number;
  /** how far ahead, minutes, each course-and-speed vector reaches */
  vectorMinutes?: number;
  /**
   * `geo:cpa_m` and `geo:tcpa_s`. Needs both vessels' `speedMps`: the marker
   * joins where each will be at the time of closest approach.
   */
  cpa?: { cpaM: number; tcpaS: number };
  labels?: SceneLabels;
}): ReactElement {
  const lay = pairLayout({
    ownHeading: own.heading,
    targetHeading: target.heading,
    relativeBearing,
    rangeM,
  });
  // every ring of both vessels stays inside the frame, whichever way it faces
  const pad = Math.max(reachPx(own), reachPx(target));
  const scale = fitScale(rangeM, SIZE - 2 * pad, 0);
  // centre the frame on the midpoint of the pair
  const mid = { x: SIZE / 2, y: SIZE / 2 };
  const off = (e: number, n: number): [number, number] =>
    toScreen(e - lay.target.east / 2, n - lay.target.north / 2, scale, mid);
  const [ox, oy] = off(0, 0);
  const [tx, ty] = off(lay.target.east, lay.target.north);
  const vector = (v: SceneVessel, x: number, y: number, id: string): ReactElement | null => {
    if (v.speedMps === undefined) return null;
    const d = travel(v, vectorMinutes * 60);
    return (
      <line
        data-vector={id}
        x1={x}
        y1={y}
        x2={x + d.east * scale}
        y2={y - d.north * scale}
        stroke="var(--accent-soft)"
        strokeWidth={1.5}
      />
    );
  };
  let cpaMarker: ReactElement | null = null;
  if (cpa && own.speedMps !== undefined && target.speedMps !== undefined) {
    const o = travel(own, cpa.tcpaS);
    const t = travel(target, cpa.tcpaS);
    const [cox, coy] = [ox + o.east * scale, oy - o.north * scale];
    const [ctx, cty] = [tx + t.east * scale, ty - t.north * scale];
    const text = (labels.sceneCpa ?? defaultSceneLabels.sceneCpa!)(cpa.cpaM, cpa.tcpaS);
    cpaMarker = (
      <g data-cpa>
        <line x1={cox} y1={coy} x2={ctx} y2={cty} stroke="var(--accent)" strokeWidth={1.5} />
        <circle cx={cox} cy={coy} r={3} fill="var(--accent)" />
        <circle cx={ctx} cy={cty} r={3} fill="var(--accent)" />
        <text
          x={(cox + ctx) / 2}
          y={(coy + cty) / 2 - 6}
          textAnchor="middle"
          fontSize={11}
          fill="var(--accent)"
        >
          {text}
        </text>
      </g>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={labels.planAlt}
      className="scene-svg plan-svg scene-pair-svg"
    >
      <rect width={SIZE} height={SIZE} fill="var(--sea-night)" />
      <line
        data-line-of-bearing
        x1={ox}
        y1={oy}
        x2={tx}
        y2={ty}
        stroke="var(--accent-soft)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {vector(own, ox, oy, 'own')}
      {vector(target, tx, ty, 'target')}
      {cpaMarker}
      <Vessel v={own} x={ox} y={oy} id="own" />
      <Vessel v={target} x={tx} y={ty} id="target" />
    </svg>
  );
}
