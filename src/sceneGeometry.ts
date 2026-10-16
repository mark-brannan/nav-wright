// Composition geometry for the two-vessel plan frame: where the target sits
// relative to own ship, the line of bearing between them, and the scale that
// fits both in one frame. Pure arithmetic; no encounter semantics (who gives
// way is not decided here).
//
// Frame: north up, own ship at the origin. Angles are degrees clockwise from
// north (true) unless named `relative`, which is clockwise from a vessel's bow.

export interface PairInput {
  /** own ship true heading, deg */
  ownHeading: number;
  /** target true heading, deg */
  targetHeading: number;
  /** target's bearing from own ship, relative to own bow, deg */
  relativeBearing: number;
  /** distance between the two, metres */
  rangeM: number;
}

export interface PairLayout {
  /** true bearing of the target from own ship, [0, 360) */
  trueBearing: number;
  /** true bearing of own ship from the target (the reciprocal), [0, 360) */
  reciprocalBearing: number;
  /** east/north offsets of the target from own ship, metres */
  target: { east: number; north: number };
  /** how the target sees own ship, relative to the target's bow, [0, 360) */
  ownFromTarget: number;
}

const wrap = (d: number): number => ((d % 360) + 360) % 360;

export function pairLayout(p: PairInput): PairLayout {
  const trueBearing = wrap(p.ownHeading + p.relativeBearing);
  const a = (trueBearing * Math.PI) / 180;
  const reciprocalBearing = wrap(trueBearing + 180);
  return {
    trueBearing,
    reciprocalBearing,
    target: { east: p.rangeM * Math.sin(a), north: p.rangeM * Math.cos(a) },
    ownFromTarget: wrap(reciprocalBearing - p.targetHeading),
  };
}

/**
 * Pixels per metre that keep both vessels, plus `marginM` around each, inside
 * a square frame of `size` px centred on the midpoint of the pair.
 */
export function fitScale(rangeM: number, size: number, marginM: number): number {
  return size / (Math.max(rangeM, 0) + 2 * marginM);
}

/** Screen point (y down) of a metre offset from the frame centre. */
export function toScreen(
  east: number,
  north: number,
  scale: number,
  centre: { x: number; y: number },
): [number, number] {
  return [centre.x + east * scale, centre.y - north * scale];
}
