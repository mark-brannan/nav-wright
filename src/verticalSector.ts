// How bright a light reads from above or below, 0..1, for the 3D bearing
// view's tuning surface (#118): Annex I §10's vertical sectors, from the
// angle between the viewer and her lights' horizontal plane. Heel tips that
// plane; camera elevation (tilt) moves the viewer. Leaving it off keeps
// today's picture, where elevation never dims a light.
//
// §10 sets minima: full required intensity within ±5° of the horizontal, and
// a share of it out to a wider band (60% at ±7.5°, or 50% at ±25° on a
// sailing vessel underway). The lantern drawn here is one that just meets
// them: it falls linearly from band to band and, past the last band, to
// nothing over VERTICAL_TAIL_DEG, which the Annex leaves open.
//
// The figures are hand-typed from the Annex I text. colregs#228 put them in
// colregs' geometry.json `sectors.vertical` (colregs#239, v0.3.10), in the
// shape VERTICAL_SECTORS copies; nav-wright still pins colregs v0.3.9 and
// colregs-engine's GeometryData does not type `vertical` yet. When both
// carry it, read the entries from geometry.json and drop this table.

import type { FactRecord } from 'colregs-engine';

/** One elevation band: at least `min_fraction` of the required intensity
 *  from `within_deg` above to `within_deg` below the horizontal. */
export interface VerticalBand {
  within_deg: number;
  min_fraction: number;
  cite: string;
}

/** One §10 paragraph, as colregs geometry.json `sectors.vertical` holds it. */
export interface VerticalSectorEntry {
  cite: string;
  /** Applies when these facts all hold. */
  when?: Record<string, string>;
  /** Applies unless these facts all hold. */
  except_when?: Record<string, string>;
  bands: VerticalBand[];
}

const SAILING_UNDERWAY = {
  'fact:propulsion': 'propulsion:sail',
  'fact:position': 'position:underway',
};

/** Annex I §10, hand-typed until colregs#228's data reaches nav-wright. */
export const VERTICAL_SECTORS: readonly VerticalSectorEntry[] = [
  {
    cite: 'AnxI.10(a)',
    except_when: SAILING_UNDERWAY,
    bands: [
      { within_deg: 5, min_fraction: 1, cite: 'AnxI.10(a)(i)' },
      { within_deg: 7.5, min_fraction: 0.6, cite: 'AnxI.10(a)(ii)' },
    ],
  },
  {
    cite: 'AnxI.10(b)',
    when: SAILING_UNDERWAY,
    bands: [
      { within_deg: 5, min_fraction: 1, cite: 'AnxI.10(b)(i)' },
      { within_deg: 25, min_fraction: 0.5, cite: 'AnxI.10(b)(ii)' },
    ],
  },
];

/** Degrees past the last band over which the light falls to nothing, by
 *  paragraph: the ends of the research note's panel 5 (gap 8), 14° and 40°. */
export const VERTICAL_TAIL_DEG: Record<string, number> = {
  'AnxI.10(a)': 6.5,
  'AnxI.10(b)': 15,
};

/** The §10 paragraph for her facts: (b) for a sailing vessel underway, (a)
 *  for every other. */
export function verticalSectorFor(
  facts: FactRecord,
  entries: readonly VerticalSectorEntry[] = VERTICAL_SECTORS,
): VerticalSectorEntry | undefined {
  const all = (want: Record<string, string>) =>
    Object.entries(want).every(([fact, v]) => facts[fact as keyof FactRecord] === v);
  return entries.find((e) => (!e.when || all(e.when)) && !(e.except_when && all(e.except_when)));
}

/** How bright a light reads, 0..1, at `elevation` degrees above (or below)
 *  its horizontal plane. */
export function verticalIntensity(elevation: number, entry: VerticalSectorEntry): number {
  if (!Number.isFinite(elevation)) return 1;
  const a = Math.abs(elevation);
  let from = { deg: 0, f: 1 };
  for (const band of entry.bands) {
    if (a <= band.within_deg) {
      const span = band.within_deg - from.deg;
      const t = span > 0 ? (a - from.deg) / span : 1;
      return from.f + (band.min_fraction - from.f) * t;
    }
    from = { deg: band.within_deg, f: band.min_fraction };
  }
  const tail = VERTICAL_TAIL_DEG[entry.cite] ?? 0;
  if (tail <= 0 || a >= from.deg + tail) return 0;
  return from.f * (1 - (a - from.deg) / tail);
}

const DEG = Math.PI / 180;

/** The viewer's elevation above her lights' horizontal plane, degrees, from
 *  relative bearing `theta`, camera elevation `tilt` above the waterline and
 *  `heel` (degrees, positive to starboard: the starboard side down). Heeled
 *  to starboard, a viewer on her starboard beam looks down on her lights by
 *  the heel; one on her port beam looks up at them. Dead ahead or astern,
 *  heel changes nothing at the waterline and flattens a tilt above it. */
export function lightElevation(theta: number, tilt: number, heel = 0): number {
  const e = tilt * DEG;
  const h = heel * DEG;
  const s = Math.sin(e) * Math.cos(h) + Math.cos(e) * Math.sin(theta * DEG) * Math.sin(h);
  return Math.asin(Math.min(1, Math.max(-1, s))) / DEG;
}
