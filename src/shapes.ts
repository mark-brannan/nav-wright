// Day shapes: where each one goes on the hull and how big it is. Placement
// only; src/shapeMarks.tsx draws. Parallel to placeLights: deterministic, and
// every number comes from colregs data passed in (shapes.json for the form
// and size, geometry.json for the spacing, the relief and the 27(d) offset),
// nothing imported at runtime.
//
// Units match placed lights: fx fore-aft in [-1, 1] (bow = +1), py
// athwartships (starboard = +), z height above the waterline in the same
// fraction-of-half-length units as PlacedLight.z; one z unit is
// metresPerZ(length) metres. fx and py units are half a length.

import type { DisplayShape, FactRecord } from 'colregs-engine';
import type { GeometryData } from 'colregs-engine/schema';
import { holds, metresPerZ } from './annexI.js';
import type { HullSpec } from './hulls.js';

/** The structural slice of colregs' shapes.json this module reads. The
 *  engine's generated `ShapesData` is not yet exported from
 *  `colregs-engine/schema`; this is assignable from it. */
export interface ShapesData {
  shapes: Record<
    string,
    {
      term: string;
      cite: string;
      color: string;
      svg: string;
      annex1?: boolean;
      min_diameter_m?: number;
      min_base_diameter_m?: number;
      min_height_m?: number;
    }
  >;
}

export interface PlacedShape {
  key: string;
  shapeId: string;
  /** shapes.json `term`, e.g. "cone, apex downwards" (for labels). */
  term: string;
  /** shapes.json `svg`, verbatim: 1 user unit = 1 m at Annex I's minimum size. */
  svg: string;
  /** The svg's own size in metres (its viewBox). */
  svgWidthM: number;
  svgHeightM: number;
  /** Relief factor applied to the drawn size (1 at 20 m and over). */
  scale: number;
  /** Drawn size in metres: svg size times `scale`. */
  widthM: number;
  heightM: number;
  sourceEntry: string;
  /** Centre of the shape. */
  fx: number;
  py: number;
  z: number;
  /** Centre height above the drawn deck line, metres. */
  heightAboveDeckM: number;
  /** z units per metre, and half the vessel's length in metres, so a view can scale. */
  zPerM: number;
  halfLengthM: number;
  /** Annex I paragraphs behind the size and spacing. */
  basis: string[];
}

/** Lengths assumed when a record states none (the 20 m Annex I threshold). */
const DEFAULT_LENGTH_M = 20;
/** Smallest fraction of Annex I's size a small-vessel relief may reach. */
const RELIEF_FLOOR = 0.5;

export function svgBox(svg: string): { w: number; h: number } | null {
  const m = /viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/.exec(svg);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}

type Item = {
  shapeId: string;
  entry: string;
  position: string;
  w: number;
  h: number;
  def: ShapesData['shapes'][string];
};

/** The Annex I 4 horizontal-offset entry geometry.json keys to a rule entry
 *  (4(a) for the 26(c)(ii) gear, 4(b) for the 27(d) sides). */
function offsetRule(geometry: GeometryData, entry: string) {
  return geometry.direction_indicating?.find((e) => e.applies_to_entries?.includes(entry));
}

const rankOf = (pos: string) =>
  pos.startsWith('upper') ? 0 : pos.startsWith('middle') ? 1 : pos.startsWith('lower') ? 2 : 1;

/**
 * Place every shape of a display on the given hull. Layouts:
 *  - a vertical stack on the mast anchor (Rule 20(d), Annex I 6: where they
 *    can best be seen), top to bottom in the display's order: 27(b)(ii)
 *    ball-diamond-ball, 26 cone apexes together, 30(d) three balls;
 *  - 27(d) side shapes `AnxI.4(b)` metres abeam of that stack, the upper
 *    one no higher than the lowest 27(b) shape;
 *  - 26(c)(ii) cone offset toward the gear; 30(a) ball in the fore part;
 *    27(f) one at the foremast head and one at each end of the fore yard.
 * Shapes the data does not know are skipped (a basket, for one).
 */
export function placeShapes(
  displayShapes: DisplayShape[],
  hull: HullSpec,
  facts: FactRecord,
  shapesData: ShapesData,
  geometry: GeometryData,
): PlacedShape[] {
  const lengthRaw = facts['fact:length_m'];
  const length = typeof lengthRaw === 'number' && lengthRaw > 0 ? lengthRaw : DEFAULT_LENGTH_M;
  const k = metresPerZ(length);
  const g = geometry.shapes;
  const relief = g.small_vessel_relief;
  const scale =
    relief && holds(relief.when as never, facts)
      ? Math.min(1, Math.max(RELIEF_FLOOR, length / DEFAULT_LENGTH_M))
      : 1;
  const spacing = (g.vertical_spacing_min_m ?? 0) * scale;
  const deckZ = hull.sideLightZ;
  const toZ = (m: number) => deckZ + m / k;

  // expand counts into one item each
  const mast: Item[] = [];
  const sides: { sign: number; items: Item[] }[] = [];
  const singles: { kind: 'fore' | 'gear' | 'yard'; items: Item[] }[] = [];
  const obstructionSign = facts['fact:obstruction_side'] === 'obstruction_side:starboard' ? 1 : -1;
  displayShapes.forEach((ds) => {
    const def = shapesData.shapes[ds.spec.shape];
    const box = def ? svgBox(def.svg) : null;
    if (!def || !box) return;
    const pos = ds.spec.position ?? '';
    const items: Item[] = Array.from({ length: ds.spec.count ?? 1 }, () => ({
      shapeId: ds.spec.shape,
      entry: ds.source_entry,
      position: pos,
      w: box.w,
      h: box.h,
      def,
    }));
    if (pos.includes('obstruction exists')) sides.push({ sign: obstructionSign, items });
    else if (pos.includes('may pass')) sides.push({ sign: -obstructionSign, items });
    else if (pos.includes('fore part')) singles.push({ kind: 'fore', items });
    else if (pos.includes('direction of the gear')) singles.push({ kind: 'gear', items });
    else if (pos.includes('fore yard')) singles.push({ kind: 'yard', items });
    else mast.push(...items);
  });

  const out: PlacedShape[] = [];
  const counter = new Map<string, number>();
  const emit = (it: Item, fx: number, py: number, centreM: number, basis: string[]) => {
    const n = counter.get(it.entry) ?? 0;
    counter.set(it.entry, n + 1);
    out.push({
      key: `${it.entry}:${n}`,
      shapeId: it.shapeId,
      term: it.def.term,
      svg: it.def.svg,
      svgWidthM: it.w,
      svgHeightM: it.h,
      scale,
      widthM: it.w * scale,
      heightM: it.h * scale,
      sourceEntry: it.entry,
      fx,
      py,
      z: toZ(centreM),
      heightAboveDeckM: centreM,
      zPerM: 1 / k,
      halfLengthM: length / 2,
      basis: [...new Set([it.def.cite, g.cite, ...basis])],
    });
  };

  /** Lay items top to bottom from a top edge (metres above deck); returns centres. */
  const stack = (items: Item[], topM: number): number[] => {
    const centres: number[] = [];
    let edge = topM;
    items.forEach((it, i) => {
      const h = it.h * scale;
      centres.push(edge - h / 2);
      const next = items[i + 1];
      // Rule 26: cones "apexes together" meet at their points
      const apexes = it.shapeId === 'shape:cone_down' && next?.shapeId === 'shape:cone_up';
      edge -= h + (apexes ? 0 : spacing);
    });
    return centres;
  };

  const mastTopM = (hull.mastTopZ - deckZ) * k;
  // stable order: by entry first appearance, then upper/middle/lower
  const entryOrder = [...new Set(mast.map((m) => m.entry))];
  const orderedMast = mast
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        entryOrder.indexOf(a.m.entry) - entryOrder.indexOf(b.m.entry) ||
        rankOf(a.m.position) - rankOf(b.m.position) ||
        a.i - b.i,
    )
    .map((x) => x.m);
  const mastCentres = stack(orderedMast, mastTopM);
  orderedMast.forEach((it, i) => emit(it, hull.mastX, 0, mastCentres[i]!, []));

  // 27(d): beside the 27(b) stack, upper no higher than its lowest shape
  const sideRule = offsetRule(geometry, 'rule:27d');
  const sideMinPy = (sideRule?.horizontal_from_ram_lights_m?.min ?? 0) / (length / 2);
  const sidePy = Math.max(sideMinPy, hull.beam * 1.6);
  const lowestIdx = orderedMast.reduce((a, m, i) => (m.entry.startsWith('rule:27b') ? i : a), -1);
  const lowest27b = lowestIdx >= 0 ? orderedMast[lowestIdx] : undefined;
  const sideTopM = lowestIdx >= 0 ? mastCentres[lowestIdx]! + (lowest27b!.h * scale) / 2 : mastTopM;
  for (const s of sides) {
    const cs = stack(s.items, sideTopM);
    s.items.forEach((it, i) =>
      emit(it, hull.mastX, s.sign * sidePy, cs[i]!, sideRule ? [sideRule.cite] : []),
    );
  }

  for (const s of singles) {
    if (s.kind === 'fore') {
      // 30(a): the forward anchor position the lights use
      const base = (hull.sideLightZ + 0.18 - deckZ) * k;
      s.items.forEach((it) => emit(it, hull.bowX - 0.08, 0, base, []));
    } else if (s.kind === 'gear') {
      const dir = offsetRule(geometry, 'rule:26c_ii');
      const offM = dir?.horizontal_from_identity_lights_m?.min ?? 0;
      const cm = mastCentres.length ? mastCentres[mastCentres.length - 1]! : mastTopM;
      s.items.forEach((it) => emit(it, hull.mastX, offM / (length / 2), cm, dir ? [dir.cite] : []));
    } else {
      // 27(f): head at the foremast, yard ends below it
      const head = s.items[0];
      if (!head) continue;
      const h = head.h * scale;
      const headC = mastTopM - h / 2;
      const yardC = headC - h - spacing;
      s.items.forEach((it, i) => {
        if (i === 0) emit(it, hull.mastX, 0, headC, []);
        else emit(it, hull.mastX, (i === 1 ? 1 : -1) * hull.beam * 1.6, yardC, []);
      });
    }
  }
  return out;
}
