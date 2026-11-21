// One lantern for a combined light. A tricolor (Rule 25(b)) or a combined
// pair is one fixture showing different colours into different sectors, so
// the bearing view draws one glow, in the colour of the sector facing the
// viewer, instead of a cluster of dots. Pure; placement is untouched.

import type { Arc } from 'colregs-engine/schema';
import { flashPeriodSeconds } from './svg.js';

export interface LanternMember {
  color: string;
  arc: Arc | null;
  sourceEntry: string;
  combined?: boolean;
  fx: number;
  z: number;
  /** How bright the member reads at the viewer's bearing, 0..1 (see
   *  sectorIntensity). Unset: the hard cut, every member in view at full. */
  intensity?: number;
}

function arcMid(arc: Arc | null): number | null {
  if (!arc) return null;
  const span = (arc.to_deg - arc.from_deg + 360) % 360 || 360;
  return (arc.from_deg + span / 2) % 360;
}

function angularGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Collapse the in-view members of each combined fixture into one, keeping
 *  the member whose sector centre is nearest the viewer's bearing (first
 *  listed on a tie). Uncombined lights pass through in order. Where members
 *  carry an `intensity` (soft sector edges), the lantern takes its brightest
 *  member's colour and the members' sum, capped at 1: one lamp behind every
 *  sector, so the lantern does not dip across a division. */
export function mergeLanterns<T extends LanternMember>(inView: readonly T[], theta: number): T[] {
  const out: T[] = [];
  const seat = new Map<string, number>();
  const peak = new Map<string, number>();
  for (const l of inView) {
    if (!l.combined) {
      out.push(l);
      continue;
    }
    const id = `${l.sourceEntry}|${l.fx}|${l.z}`;
    const at = seat.get(id);
    if (at === undefined) {
      seat.set(id, out.length);
      out.push(l);
      continue;
    }
    const kept = out[at]!;
    const gap = (m: T) => angularGap(theta, arcMid(m.arc) ?? theta);
    if (l.intensity === undefined && kept.intensity === undefined) {
      if (gap(l) < gap(kept)) out[at] = l;
      continue;
    }
    // compare members by their own brightness, not the running sum
    const a = peak.get(id) ?? kept.intensity ?? 1;
    const b = l.intensity ?? 1;
    const winner = b > a || (b === a && gap(l) < gap(kept)) ? l : kept;
    peak.set(id, Math.max(a, b));
    out[at] = { ...winner, intensity: Math.min(1, (kept.intensity ?? 1) + b) };
  }
  return out;
}

/** Today's 3D flash: a 1.2 s period, on for the first 0.35 s. */
export const FLASH_PERIOD_S = 1.2;
export const FLASH_ON_S = 0.35;

/** Whether a flashing light is lit at `t` seconds: on for the first
 * `onSeconds` of each period, the period being 60 / `flashesPerMinute`
 * (FLASH_PERIOD_S without a rate). */
export function flashLit(t: number, flashesPerMinute?: number, onSeconds = FLASH_ON_S): boolean {
  const period =
    flashesPerMinute !== undefined && flashesPerMinute > 0
      ? flashPeriodSeconds(flashesPerMinute)
      : FLASH_PERIOD_S;
  return t % period < onSeconds;
}
