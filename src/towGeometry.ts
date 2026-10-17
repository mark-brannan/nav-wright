// Where the hulls of a tow or pushed group sit relative to one another, in
// metres along one centreline, and Rule 24(a)'s tow-length threshold read
// out of colregs' applicability data. Pure: no React, no drawing.

import type { HullSpec } from './hulls.js';

/** How a member hull is held to the vessel ahead of it, or to the lead. */
export type TowTie = 'astern' | 'alongside' | 'pushed_ahead';

/** One hull for layout: its drawing's ends and its length overall. */
export interface TowHullInput {
  spec: Pick<HullSpec, 'bowX' | 'sternX' | 'beam'>;
  lengthM: number;
  tie?: TowTie;
  /** astern only: line from the stern ahead of it to this hull's bow, m */
  lineM?: number;
}

export interface TowHullPlace {
  /** fore-aft position of the hull's fx = 0, m; the lead's is 0, bow positive */
  originM: number;
  /** athwartships offset of the centreline, m; starboard positive */
  yM: number;
  /** metres per fx unit: the drawn bowX..sternX span is the length overall */
  mPerUnit: number;
  bowM: number;
  sternM: number;
  halfBeamM: number;
}

export interface TowLayout {
  /** lead first, then the members in order */
  hulls: TowHullPlace[];
  minM: number;
  maxM: number;
  /** widest reach athwartships either side of the centreline, m */
  halfWidthM: number;
  /** 24(a)(i)'s tow length: lead's stern to the after end of the tow; absent with no hull astern */
  tow?: { fromM: number; toM: number; lengthM: number };
}

/** Lay the group out: astern hulls on their lines behind the lead, pushed hulls bow to stern ahead of it, alongside hulls beside it with their sterns level. */
export function layoutTow(lead: TowHullInput, members: TowHullInput[]): TowLayout {
  const place = (h: TowHullInput, originM: number, yM: number): TowHullPlace => {
    const mPerUnit = h.lengthM / (h.spec.bowX - h.spec.sternX);
    return {
      originM,
      yM,
      mPerUnit,
      bowM: originM + h.spec.bowX * mPerUnit,
      sternM: originM + h.spec.sternX * mPerUnit,
      halfBeamM: h.spec.beam * mPerUnit,
    };
  };
  const head = place(lead, 0, 0);
  const hulls = [head];
  let aftM = head.sternM;
  let foreM = head.bowM;
  let towed = false;
  const side = { stbd: head.halfBeamM, port: head.halfBeamM };
  let alongside = 0;
  for (const m of members) {
    const k = m.lengthM / (m.spec.bowX - m.spec.sternX);
    const tie = m.tie ?? 'astern';
    let p: TowHullPlace;
    if (tie === 'pushed_ahead') {
      p = place(m, foreM - m.spec.sternX * k, 0);
      foreM = p.bowM;
    } else if (tie === 'alongside') {
      const halfBeam = m.spec.beam * k;
      const stbd = alongside++ % 2 === 0;
      const yM = stbd ? side.stbd + halfBeam : -(side.port + halfBeam);
      if (stbd) side.stbd += 2 * halfBeam;
      else side.port += 2 * halfBeam;
      p = place(m, head.sternM - m.spec.sternX * k, yM);
    } else {
      const line = Math.max(0, m.lineM ?? 0);
      p = place(m, aftM - line - m.spec.bowX * k, 0);
      aftM = p.sternM;
      towed = true;
    }
    hulls.push(p);
  }
  const halfWidthM = Math.max(...hulls.map((h) => Math.abs(h.yM) + h.halfBeamM));
  return {
    hulls,
    minM: Math.min(...hulls.map((h) => h.sternM)),
    maxM: Math.max(...hulls.map((h) => h.bowM)),
    halfWidthM,
    tow: towed ? { fromM: head.sternM, toM: aftM, lengthM: head.sternM - aftM } : undefined,
  };
}

/** Rule 24(a)(i)'s split: the tow length it turns on and the masthead lights either side of it. */
export interface TowThreshold {
  /** the length, m: at or under it two masthead lights, over it three */
  thresholdM: number;
  mastheadAtOrUnder: number;
  mastheadOver: number;
  /** the applicability entries it was read from */
  entries: [string, string];
}

interface LooseEntry {
  id: string;
  jurisdiction?: string;
  when?: Record<string, unknown>;
  lights?: { light: string; count?: number }[];
}

/**
 * Read 24(a)(i)'s threshold out of colregs' `applicability.json`: the
 * towing entries that split on `fact:tow_length_m`, one `lte` and one `gt`
 * the same length, and the masthead count each prescribes. Undefined when
 * the data carries no such pair, so a view draws no marker rather than a
 * guessed one.
 */
export function towThreshold(
  applicability: { entries: readonly unknown[] },
  jurisdiction = 'intl',
): TowThreshold | undefined {
  const towing = (applicability.entries as readonly LooseEntry[]).filter(
    (e) =>
      (e.jurisdiction ?? 'intl') === jurisdiction &&
      e.when?.['fact:activity'] === 'activity:towing' &&
      typeof e.when?.['fact:tow_length_m'] === 'object',
  );
  const masthead = (e: LooseEntry) => e.lights?.find((l) => l.light === 'light:masthead');
  const bound = (e: LooseEntry, op: 'lte' | 'gt') =>
    (e.when!['fact:tow_length_m'] as Record<string, unknown>)[op];
  for (const under of towing) {
    const t = bound(under, 'lte');
    const m = masthead(under);
    if (typeof t !== 'number' || !m) continue;
    const over = towing.find((e) => bound(e, 'gt') === t && masthead(e));
    if (!over) continue;
    return {
      thresholdM: t,
      mastheadAtOrUnder: m.count ?? 1,
      mastheadOver: masthead(over)!.count ?? 1,
      entries: [under.id, over.id],
    };
  }
  return undefined;
}
