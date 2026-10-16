// Shared SVG bits: the light glow and sector-arc path math.

import type { ReactElement } from 'react';

export const LIGHT_COLORS: Record<string, string> = {
  white: '#f5f5f0',
  red: '#ff4d42',
  green: '#3fd05e',
  yellow: '#ffd23f',
};

export function lightFill(color: string): string {
  return LIGHT_COLORS[color] ?? LIGHT_COLORS.white;
}

/** Glow sizing for one light: radius multipliers for the bloom and halo and an
 *  opacity for both. `FLAT_GLOW` is the original look. */
export interface GlowProfile {
  scale: number;
  opacity: number;
}

export const FLAT_GLOW: GlowProfile = { scale: 1, opacity: 1 };

/** Range-scaled glow. `reachNm` is the light's Rule 22 range from lights.json;
 *  `viewingNm` is how far off the observer is, when known. A 6 nm masthead
 *  blooms wider than a 1 nm sidelight (scale 1 at 3 nm, clamped 0.55..1.5);
 *  the glow dims as the viewing distance closes on the light's reach
 *  (1 at point-blank, 0.5 at the reach, floor 0.35 beyond it). Only the
 *  drawing changes: whether the light is seen is the arc's call. */
export function glowProfile(reachNm: number | undefined, viewingNm?: number): GlowProfile {
  if (reachNm === undefined || !(reachNm > 0)) return FLAT_GLOW;
  const scale = Math.min(1.5, Math.max(0.55, Math.sqrt(reachNm / 3)));
  const opacity =
    viewingNm === undefined || Number.isNaN(viewingNm)
      ? 1
      : Math.min(1, Math.max(0.35, 1.25 - (0.75 * Math.max(0, viewingNm)) / reachNm));
  return { scale, opacity };
}

type VisibilityBand = {
  when?: { 'fact:length_m'?: { gte?: number; lt?: number } };
  ranges_nm?: Record<string, number>;
  overrides_nm?: Record<string, number>;
};

/** Rule 22 ranges in nautical miles by lightId for a vessel of `lengthM`,
 *  read from lights.json `visibility` (length bands only; the lightId of each
 *  sidelight takes the sidelights range, flashing the all-round range). */
export function lightRangesFor(
  lightsData: { visibility?: { bands?: VisibilityBand[] } },
  lengthM: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const band of lightsData.visibility?.bands ?? []) {
    const w = band.when?.['fact:length_m'];
    if (!w || (w.gte !== undefined && lengthM < w.gte) || (w.lt !== undefined && lengthM >= w.lt))
      continue;
    Object.assign(out, band.ranges_nm, band.overrides_nm);
  }
  if (out['light:sidelights'] !== undefined) {
    out['light:sidelight_starboard'] = out['light:sidelights'];
    out['light:sidelight_port'] = out['light:sidelights'];
  }
  if (out['light:all_round'] !== undefined) out['light:flashing'] = out['light:all_round'];
  return out;
}

/** Seconds per flash cycle for a rate in flashes per minute. */
export function flashPeriodSeconds(flashesPerMinute: number): number {
  return 60 / flashesPerMinute;
}

/** A light's declared minimum flash rate (lights.json `flashes_per_minute_min`,
 *  120 for Rule 21(f)), or undefined when it declares none. */
export function declaredFlashRate(
  lightsData: { lights: Record<string, { flashes_per_minute_min?: number }> },
  lightId: string,
): number | undefined {
  return lightsData.lights[lightId]?.flashes_per_minute_min;
}

export function Glow({
  x,
  y,
  color,
  r = 5,
  flashing = false,
  dim = false,
  glow = FLAT_GLOW,
  flashesPerMinute,
}: {
  x: number;
  y: number;
  color: string;
  r?: number;
  flashing?: boolean;
  dim?: boolean;
  /** Range-scaled glow (see glowProfile). Default: the flat original. */
  glow?: GlowProfile;
  /** Flash at this rate instead of the stylesheet's default cycle. */
  flashesPerMinute?: number;
}): ReactElement {
  const fill = lightFill(color);
  const { scale, opacity } = glow;
  const style =
    flashing && flashesPerMinute && flashesPerMinute > 0
      ? { animationDuration: `${flashPeriodSeconds(flashesPerMinute)}s` }
      : undefined;
  return (
    <g className={flashing ? 'light-flash' : undefined} style={style} opacity={dim ? 0.45 : 1}>
      <circle cx={x} cy={y} r={r * 2.6 * scale} fill={fill} opacity={0.16 * opacity} />
      <circle cx={x} cy={y} r={r * 1.5 * scale} fill={fill} opacity={0.3 * opacity} />
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x} cy={y} r={r * 0.45} fill="#ffffff" opacity={0.85} />
    </g>
  );
}

/** Point at bearing β (deg cw from ahead) and radius r, bow pointing up. */
export function polar(cx: number, cy: number, r: number, bearingDeg: number): [number, number] {
  const a = (bearingDeg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Annulus sector from bearing `from` clockwise to `to`. */
export function sectorPath(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  from: number,
  to: number,
): string {
  let extent = (to - from + 360) % 360;
  if (extent === 0) extent = 360;
  if (extent >= 360) {
    // full ring: two half arcs
    const [ax, ay] = polar(cx, cy, r1, 0);
    const [bx, by] = polar(cx, cy, r1, 180);
    const [cx0, cy0] = polar(cx, cy, r0, 0);
    const [dx, dy] = polar(cx, cy, r0, 180);
    return [
      `M${ax},${ay}`,
      `A${r1},${r1} 0 1 1 ${bx},${by}`,
      `A${r1},${r1} 0 1 1 ${ax},${ay}`,
      `M${cx0},${cy0}`,
      `A${r0},${r0} 0 1 0 ${dx},${dy}`,
      `A${r0},${r0} 0 1 0 ${cx0},${cy0}`,
    ].join(' ');
  }
  const large = extent > 180 ? 1 : 0;
  const [a1x, a1y] = polar(cx, cy, r1, from);
  const [a2x, a2y] = polar(cx, cy, r1, to);
  const [b2x, b2y] = polar(cx, cy, r0, to);
  const [b1x, b1y] = polar(cx, cy, r0, from);
  return [
    `M${a1x},${a1y}`,
    `A${r1},${r1} 0 ${large} 1 ${a2x},${a2y}`,
    `L${b2x},${b2y}`,
    `A${r0},${r0} 0 ${large} 0 ${b1x},${b1y}`,
    'Z',
  ].join(' ');
}
