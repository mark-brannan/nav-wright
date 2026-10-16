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

/** A `kin:position`: WGS84 latitude/longitude, degrees. */
export interface LatLon {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

/**
 * The pair input from two `kin:position`s and two `kin:heading_deg`s. A local
 * flat-earth (equirectangular) projection about the pair's mean latitude:
 * well inside a metre per nautical mile at encounter ranges.
 */
export function pairFromPositions(
  own: LatLon,
  target: LatLon,
  ownHeading: number,
  targetHeading: number,
): PairInput {
  const rad = Math.PI / 180;
  const dLon = wrap(target.longitude - own.longitude + 180) - 180;
  const meanLat = ((own.latitude + target.latitude) / 2) * rad;
  const north = (target.latitude - own.latitude) * rad * EARTH_RADIUS_M;
  const east = dLon * rad * EARTH_RADIUS_M * Math.cos(meanLat);
  const trueBearing = wrap(Math.atan2(east, north) / rad);
  return {
    ownHeading,
    targetHeading,
    relativeBearing: wrap(trueBearing - ownHeading),
    rangeM: Math.hypot(east, north),
  };
}

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
 * The θ that `BearingView` wants to show what own ship sees of the target:
 * the bearing of own ship from the target, relative to the target's bow. Fed
 * the target's hull and placed lights, the view then draws exactly the lights
 * (and sidelight cutoffs) own ship can see. Geometry only; it says nothing of
 * who gives way.
 */
export function bearingTheta(p: PairInput): number {
  return pairLayout(p).ownFromTarget;
}

/**
 * Pixels per metre that keep both vessels, plus `marginM` around each, inside
 * a square frame of `size` px centred on the midpoint of the pair.
 */
export function fitScale(rangeM: number, size: number, marginM: number): number {
  const span = Math.max(rangeM, 0) + 2 * Math.max(marginM, 0);
  // a pair at zero range with no margin has no extent to fit; one px per metre
  // keeps the frame finite instead of dividing by zero
  return span > 0 ? size / span : 1;
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
