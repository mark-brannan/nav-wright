// One lantern for a combined light. A tricolor (Rule 25(b)) or a combined
// pair is one fixture showing different colours into different sectors, so
// the bearing view draws one glow, in the colour of the sector facing the
// viewer, instead of a cluster of dots. Pure; placement is untouched.

import type { Arc } from 'colregs-engine/schema';

export interface LanternMember {
  color: string;
  arc: Arc | null;
  sourceEntry: string;
  combined?: boolean;
  fx: number;
  z: number;
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
 *  listed on a tie). Uncombined lights pass through in order. */
export function mergeLanterns<T extends LanternMember>(inView: readonly T[], theta: number): T[] {
  const out: T[] = [];
  const seat = new Map<string, number>();
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
    const gap = (m: T) => angularGap(theta, arcMid(m.arc) ?? theta);
    if (gap(l) < gap(out[at]!)) out[at] = l;
  }
  return out;
}
