// A tow or a pushed group as one composition: several hulls on one
// centreline, the tow line or the push contact between them, and each hull
// carrying her own lawful display from placeLights. The plan draws every
// hull's arcs and labels the tow length against Rule 24(a)(i)'s threshold;
// the profile stands the hulls end to end on a common waterline. Like
// SceneView it is composition only; the displays come from the engine.

import type { ReactElement } from 'react';
import type { Display, FactRecord } from 'colregs-engine';
import type { GeometryData, LightsData } from 'colregs-engine/schema';
import { PX, PZ, selectHull } from './hulls.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { placeLights } from './placement.js';
import type { SceneVessel } from './SceneView.js';
import { ringsOf } from './SceneView.js';
import { placeShapes } from './shapes.js';
import type { PlacedShape, ShapesData } from './shapes.js';
import { ProfileShapes } from './shapeMarks.js';
import { Glow, lightFill, sectorPath } from './svg.js';
import { useHullStylePaint } from './hullStyles.js';
import { layoutTow } from './towGeometry.js';
import type { TowLayout, TowThreshold, TowTie } from './towGeometry.js';

/** A vessel of a tow: a scene vessel with her length, to scale the group, and her day shapes. */
export interface TowVessel extends SceneVessel {
  /** length overall, m; default 30 */
  lengthM?: number;
  /** day shapes from placeShapes, drawn by the profile in `time: 'day'` */
  shapes?: PlacedShape[];
}

export interface TowGroup {
  lead: TowVessel;
  members: { vessel: TowVessel; tie: TowTie; lineM?: number }[];
  /**
   * 24(b): the lead and the vessels pushed ahead of her are rigidly joined
   * and lit as one power-driven vessel, the lead's display; the members
   * carry none of their own.
   */
  composite?: boolean;
}

const DEFAULT_LENGTH_M = 30;
const lengthOf = (v: TowVessel) => v.lengthM ?? DEFAULT_LENGTH_M;

/** One vessel of a group as the engine sees her: her own fact record and the display evaluated from it. */
export interface TowRecord {
  facts: FactRecord;
  display: Display;
}

/**
 * Build a TowGroup from each vessel's fact record and display: selectHull
 * and placeLights per record, placeShapes too when shapes and geometry data
 * are given. A member's tie is read from her `fact:tow_rigidity` (24(f)),
 * else from the lead (pushing: pushed ahead; `fact:towed_alongside`:
 * alongside), else astern. The lead's `fact:tow_length_m` sets the astern
 * lines, shared out after the towed hulls' own lengths. With the lead's
 * `fact:composite_unit` the group is one 24(b) vessel: her display stands
 * for the unit and the pushed members are drawn unlit.
 */
export function towGroupFromRecords(
  lead: TowRecord,
  members: TowRecord[],
  data: { lights: LightsData; geometry?: GeometryData; shapes?: ShapesData },
  heading = 0,
): TowGroup {
  const vessel = (r: TowRecord, lit: boolean): TowVessel => {
    const hull = selectHull(r.facts);
    const len = r.facts['fact:length_m'];
    return {
      hull,
      heading,
      lengthM: typeof len === 'number' && len > 0 ? len : undefined,
      placed: lit
        ? placeLights(r.display.lights, hull.spec, r.facts, data.lights, data.geometry)
        : [],
      shapes:
        lit && data.shapes && data.geometry
          ? placeShapes(r.display.shapes, hull.spec, r.facts, data.shapes, data.geometry)
          : [],
    };
  };
  const composite = lead.facts['fact:composite_unit'] === true;
  const leadFacts = lead.facts as Readonly<Record<string, unknown>>;
  const tieOf = (r: TowRecord): TowTie => {
    const rigidity = (r.facts as Readonly<Record<string, unknown>>)['fact:tow_rigidity'];
    if (rigidity === 'tow_rigidity:pushed_ahead') return 'pushed_ahead';
    if (rigidity === 'tow_rigidity:alongside') return 'alongside';
    if (rigidity === 'tow_rigidity:line') return 'astern';
    if (leadFacts['fact:activity'] === 'activity:pushing') return 'pushed_ahead';
    if (leadFacts['fact:towed_alongside'] === true) return 'alongside';
    return 'astern';
  };
  const out = members.map((r) => {
    const tie = composite ? 'pushed_ahead' : tieOf(r);
    return { vessel: vessel(r, !composite), tie } as TowGroup['members'][number];
  });
  const tow = lead.facts['fact:tow_length_m'];
  const astern = out.filter((m) => m.tie === 'astern');
  if (typeof tow === 'number' && astern.length > 0) {
    const hulls = astern.reduce((s, m) => s + lengthOf(m.vessel), 0);
    const lineM = Math.max(0, (tow - hulls) / astern.length);
    for (const m of astern) m.lineM = lineM;
  }
  return { lead: vessel(lead, true), members: out, ...(composite ? { composite } : {}) };
}

/** Lay out a group's hulls in metres, lead first. */
export function towLayout(group: TowGroup): TowLayout {
  return layoutTow(
    { spec: group.lead.hull.spec, lengthM: lengthOf(group.lead) },
    group.members.map((m) => ({
      spec: m.vessel.hull.spec,
      lengthM: lengthOf(m.vessel),
      tie: m.tie,
      lineM: m.lineM,
    })),
  );
}

// --accent is the consumer's; the package stylesheet defines only the soft one
const ACCENT = 'var(--accent, var(--accent-soft))';
const WIDTH = 800;
const MARGIN_PX = 56;
const RING_GAP_PX = 6;
const RING_STEP_PX = 5;
const RING_WIDTH_PX = 4;

/** Horizontal frame: px per metre and the metre mark at the left margin, the threshold kept in view. */
function frame(lay: TowLayout, threshold: TowThreshold | undefined) {
  const minM = Math.min(
    lay.minM,
    lay.tow && threshold ? lay.tow.fromM - threshold.thresholdM : lay.minM,
  );
  const span = Math.max(1, lay.maxM - minM);
  const pxPerM = (WIDTH - 2 * MARGIN_PX) / span;
  return { pxPerM, x: (m: number) => MARGIN_PX + (m - minM) * pxPerM };
}

function vesselsOf(group: TowGroup): { v: TowVessel; tie: TowTie | 'lead' }[] {
  return [
    { v: group.lead, tie: 'lead' },
    ...group.members.map((m) => ({ v: m.vessel, tie: m.tie })),
  ];
}

/** The dimension line under the tow: its length, and the marker at the threshold. */
function TowDimension({
  lay,
  x,
  y,
  threshold,
  labels,
}: {
  lay: TowLayout;
  x: (m: number) => number;
  y: number;
  threshold?: TowThreshold;
  labels: SceneLabels;
}): ReactElement | null {
  if (!lay.tow) return null;
  const { fromM, toM, lengthM } = lay.tow;
  const t = threshold?.thresholdM;
  const over = t !== undefined && lengthM > t;
  const text = (labels.towLength ?? defaultSceneLabels.towLength!)(lengthM, t);
  return (
    <g
      data-tow-length={Math.round(lengthM)}
      data-tow-over-threshold={t === undefined ? undefined : String(over)}
    >
      <line x1={x(toM)} y1={y} x2={x(fromM)} y2={y} stroke={ACCENT} strokeWidth={1.2} />
      {[toM, fromM].map((m) => (
        <line key={m} x1={x(m)} y1={y - 5} x2={x(m)} y2={y + 5} stroke={ACCENT} strokeWidth={1.2} />
      ))}
      <text x={(x(toM) + x(fromM)) / 2} y={y - 7} textAnchor="middle" fontSize={12} fill={ACCENT}>
        {text}
      </text>
      {t !== undefined && (
        <g data-threshold={t}>
          <line
            x1={x(fromM - t)}
            y1={y - 12}
            x2={x(fromM - t)}
            y2={y + 12}
            stroke="var(--accent-soft)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text
            x={x(fromM - t)}
            y={y + 24}
            textAnchor="middle"
            fontSize={11}
            fill="var(--accent-soft)"
          >
            {(labels.towThreshold ?? defaultSceneLabels.towThreshold!)(t)}
          </text>
        </g>
      )}
    </g>
  );
}

/** The tow line from each astern hull's bow to the stern ahead of it, or the contact mark between pushed and alongside hulls. */
function ties(
  group: TowGroup,
  lay: TowLayout,
  at: (m: number, yM: number) => [number, number],
): ReactElement[] {
  let aftM = lay.hulls[0]!.sternM;
  let foreM = lay.hulls[0]!.bowM;
  return group.members.map((m, i) => {
    const p = lay.hulls[i + 1]!;
    if (m.tie === 'astern') {
      const [x1, y1] = at(aftM, 0);
      const [x2, y2] = at(p.bowM, 0);
      aftM = p.sternM;
      return (
        <line
          key={i}
          data-tow-line={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--rig-stroke)"
          strokeWidth={1.2}
        />
      );
    }
    const contactM = m.tie === 'pushed_ahead' ? foreM : (p.bowM + p.sternM) / 2;
    if (m.tie === 'pushed_ahead') foreM = p.bowM;
    const [cx, cy] = at(contactM, m.tie === 'alongside' ? p.yM / 2 : 0);
    return (
      <circle
        key={i}
        data-contact={m.tie}
        cx={cx}
        cy={cy}
        r={2.5}
        fill="none"
        stroke="var(--accent-soft)"
        strokeWidth={1.2}
      />
    );
  });
}

/**
 * The group from above, bow to the right: every hull at scale with her own
 * arc rings and lights, the tow line astern or the contact where hulls
 * touch, and the tow length against `threshold` (from `towThreshold`).
 */
export function TowPlanView({
  group,
  threshold,
  labels = defaultSceneLabels,
}: {
  group: TowGroup;
  threshold?: TowThreshold;
  labels?: SceneLabels;
}): ReactElement {
  const lay = towLayout(group);
  const { pxPerM, x } = frame(lay, threshold);
  const vs = vesselsOf(group);
  const reach = (i: number) => {
    const p = lay.hulls[i]!;
    const n = ringsOf(vs[i]!.v.placed).length;
    const half = ((p.bowM - p.sternM) / 2) * pxPerM;
    // an unlit hull reaches only her own beam; rings reach past her ends
    const own =
      n === 0 ? p.halfBeamM * pxPerM : half + RING_GAP_PX + (n - 1) * RING_STEP_PX + RING_WIDTH_PX;
    return Math.abs(p.yM) * pxPerM + own;
  };
  const reachPx = Math.max(lay.halfWidthM * pxPerM, ...vs.map((_, i) => reach(i)));
  const cy = reachPx + 12;
  const height = Math.ceil(cy + reachPx + (lay.tow ? 56 : 12));
  const at = (m: number, yM: number): [number, number] => [x(m), cy + yM * pxPerM];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={labels.towPlanAlt ?? defaultSceneLabels.towPlanAlt}
      className="scene-svg plan-svg tow-plan-svg"
      data-composite={group.composite ? 'true' : undefined}
    >
      <rect width={WIDTH} height={height} fill="var(--sea-night)" />
      {ties(group, lay, at)}
      {vs.map(({ v, tie }, i) => {
        const p = lay.hulls[i]!;
        const s = p.mPerUnit * pxPerM;
        const half = ((p.bowM - p.sternM) / 2) * pxPerM;
        const [hx, hy] = at(p.originM, p.yM);
        const hullPath =
          v.hull.plan
            .map(
              ([fx, py], j) =>
                `${j === 0 ? 'M' : 'L'}${(fx * s).toFixed(1)},${(py * s).toFixed(1)}`,
            )
            .join(' ') + ' Z';
        return (
          <g key={i} data-hull={v.hull.spec.id} data-tie={tie} transform={`translate(${hx} ${hy})`}>
            {ringsOf(v.placed).map((l, r) => (
              <path
                key={l.key}
                d={sectorPath(
                  0,
                  0,
                  half + RING_GAP_PX + r * RING_STEP_PX,
                  half + RING_GAP_PX + r * RING_STEP_PX + RING_WIDTH_PX,
                  l.arc!.from_deg + 90,
                  l.arc!.to_deg + 90,
                )}
                fill={lightFill(l.color)}
                opacity={0.35}
              />
            ))}
            <path
              d={hullPath}
              fill="var(--hull-fill)"
              stroke="var(--hull-stroke)"
              strokeWidth={1.2}
            />
            {v.placed
              .filter((l) => l.arc !== null)
              .map((l) => (
                <Glow
                  key={l.key}
                  x={l.fx * s}
                  y={l.py * s}
                  color={l.color}
                  r={2.2}
                  flashing={l.character === 'flashing'}
                />
              ))}
          </g>
        );
      })}
      <TowDimension lay={lay} x={x} y={cy + reachPx + 22} threshold={threshold} labels={labels} />
    </svg>
  );
}

const PROFILE_HEIGHT = 240;
const WATERLINE = PZ(0);

/**
 * The group from abeam, starboard side, bow to the right: each hull's own
 * drawing scaled to her length and stood on one waterline, end to end by
 * her bowX and sternX, with her lights by night or her day shapes by day.
 * Hulls alongside are drawn behind the lead.
 */
export function TowProfileView({
  group,
  threshold,
  time = 'night',
  labels = defaultSceneLabels,
}: {
  group: TowGroup;
  threshold?: TowThreshold;
  time?: 'day' | 'night';
  labels?: SceneLabels;
}): ReactElement {
  const day = time === 'day';
  const paint = useHullStylePaint(undefined, 'profile', time);
  const lay = towLayout(group);
  const { pxPerM, x } = frame(lay, threshold);
  const vs = vesselsOf(group);
  // alongside hulls first, so the lead and her line stand in front
  const order = vs
    .map((_, i) => i)
    .sort((a, b) => +(vs[b]!.tie === 'alongside') - +(vs[a]!.tie === 'alongside'));
  const at = (m: number): [number, number] => [x(m), WATERLINE - 4];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${PROFILE_HEIGHT}`}
      role="img"
      aria-label={labels.towProfileAlt ?? defaultSceneLabels.towProfileAlt}
      className="scene-svg tow-profile-svg"
      style={paint.vars}
      data-composite={group.composite ? 'true' : undefined}
    >
      <rect width={WIDTH} height={PROFILE_HEIGHT} fill="var(--sea-night)" />
      <line
        x1={0}
        y1={WATERLINE}
        x2={WIDTH}
        y2={WATERLINE}
        stroke="var(--waterline)"
        strokeWidth={1}
      />
      <rect
        x={0}
        y={WATERLINE}
        width={WIDTH}
        height={PROFILE_HEIGHT - WATERLINE}
        fill="var(--sea-below)"
      />
      {ties(group, lay, (m) => at(m))}
      {order.map((i) => {
        const { v, tie } = vs[i]!;
        const p = lay.hulls[i]!;
        // the drawing's own px per fx unit is 185 (PX); scale it to metres
        const a = (p.mPerUnit * pxPerM) / 185;
        const ox = x(p.originM);
        const sx = (fx: number) => ox + (PX(fx) - PX(0)) * a;
        const sy = (z: number) => WATERLINE - (WATERLINE - PZ(z)) * a;
        return (
          <g
            key={i}
            data-hull={v.hull.spec.id}
            data-tie={tie}
            opacity={tie === 'alongside' ? 0.7 : undefined}
          >
            <g
              transform={`translate(${ox} ${WATERLINE}) scale(${a}) translate(${-PX(0)} ${-WATERLINE})`}
            >
              <v.hull.Profile />
              {day && v.shapes && <ProfileShapes shapes={v.shapes} />}
            </g>
            {!day &&
              v.placed.map((l) => (
                <Glow
                  key={l.key}
                  x={sx(l.fx) + l.py * 10 * a}
                  y={sy(l.z)}
                  color={l.color}
                  flashing={l.character === 'flashing'}
                  dim={l.py < -0.05}
                  r={3}
                />
              ))}
          </g>
        );
      })}
      <TowDimension lay={lay} x={x} y={WATERLINE + 22} threshold={threshold} labels={labels} />
    </svg>
  );
}
