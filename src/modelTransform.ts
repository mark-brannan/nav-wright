// Pure geometry for seating a 3D hull model in the profile scene: scale to
// the vessel's length, rotate the source model's up-axis onto three.js's,
// centre it fore-aft and athwartships, and rest the keel on the waterline.
//
// Deliberately free of three.js and React so it can be unit-tested with
// plain numbers (modelTransform.test.ts) and travel alongside placement.ts
// if these renderers move into a library. The caller supplies the model's
// untransformed bounding box; everything after that is arithmetic.

import type { PlacedLight } from './placement.js';
import { lightsInView } from './placement.js';
import { MAX_TILT, MIN_TILT } from './tilt.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An axis-aligned bounding box in the source model's own coordinates. */
export interface ModelBox {
  min: Vec3;
  max: Vec3;
}

export interface ModelPlacement {
  /** Uniform scale factor applied to the model. */
  scale: number;
  /** Rotation about X, in radians, applied before the scale is measured. */
  rotationX: number;
  /** Translation applied after rotation and scale, as [x, y, z]. */
  position: [number, number, number];
}

/**
 * Source models here (Benchy, from an STL) are authored Z-up with the bow
 * on local +X. A quarter turn about X puts height on three.js's +Y and
 * leaves the bow on +X — the "bow right" convention the SVG profile uses.
 */
export const MODEL_ROTATION_X = -Math.PI / 2;

/**
 * The fore-aft extent of the hull spec the model stands in for, as
 * fractions of the half-length (`fx` units, bow on +X): the 2D profile's
 * stern and bow. No spec spans [-1, 1], so a mesh fitted to the full
 * length lands its stern and bow beyond the spec's, and every light seated
 * at a spec station lands off the mesh's counterpart of it.
 */
export interface HullSpan {
  sternX: number;
  bowX: number;
}

/**
 * Where to put a hull model so it reads as a vessel of `lengthMeters`
 * floating at the origin: bow on +X, keel on the waterline (y = 0).
 *
 * With a `span`, the mesh is fitted to the spec's own extent: its length
 * becomes `(bowX - sternX) * L/2` and its stern lands at `sternX * L/2`, so
 * the mesh and lightPosition()'s analytic stations share one frame. Without
 * one — or with one that is not finite or has the bow aft of the stern —
 * the mesh is fitted to the full length and centred fore-aft. Either way it
 * is centred athwartships.
 *
 * A degenerate model (no length) or a nonsense vessel length leaves the
 * scale at 1 rather than collapsing or inverting the mesh, and centred
 * fore-aft: there is no length for a span to be a fraction of.
 *
 * `waterlineZ` is the model's own waterline height, in its coordinates,
 * for a mesh with an underbody: that height lands on the water and the
 * keel below it. Absent, the lowest point does, as a mesh drawn down to
 * the waterline wants.
 */
export function placeHullModel(
  raw: ModelBox,
  lengthMeters: number,
  span?: HullSpan,
  waterlineZ?: number,
): ModelPlacement {
  const rawLength = raw.max.x - raw.min.x;
  const fits = rawLength > 0 && Number.isFinite(lengthMeters) && lengthMeters > 0;
  const spanned =
    fits &&
    span !== undefined &&
    Number.isFinite(span.sternX) &&
    Number.isFinite(span.bowX) &&
    span.bowX > span.sternX;
  const target = spanned ? ((span.bowX - span.sternX) * lengthMeters) / 2 : lengthMeters;
  const scale = fits ? target / rawLength : 1;

  // MODEL_ROTATION_X maps local (x, y, z) to world (x, z, -y), so the
  // world extents of the scaled box are:
  //   x: [s*min.x, s*max.x]   (fore-aft)
  //   y: [s*min.z, s*max.z]   (height)
  //   z: [-s*max.y, -s*min.y] (athwartships)
  const shiftX = spanned
    ? (span.sternX * lengthMeters) / 2 - scale * raw.min.x
    : -(scale * (raw.min.x + raw.max.x)) / 2;
  const keelY = scale * (Number.isFinite(waterlineZ) ? (waterlineZ as number) : raw.min.z);
  const centreZ = (-scale * (raw.min.y + raw.max.y)) / 2;

  return {
    scale,
    rotationX: MODEL_ROTATION_X,
    position: [shiftX, -keelY, -centreZ],
  };
}

/**
 * Where a placed light sits in the 3D scene, in the same world the hull
 * model is placed into: bow on +X, up on +Y, starboard on +Z. (Bow and up
 * fix the third axis: in a right-handed frame X x Y = Z is east when X is
 * north and Y is up, so +Z is starboard. Get this backwards and the
 * sidelights swap sides, which is the one error this app cannot make.)
 *
 * `placeLights` works in hull-relative fractions (fx fore-aft, py
 * athwartships, z height) that the SVG profile scales by PX/PZ. The ratio
 * of those two scales (150 vertical to 185 half-length) is what keeps a
 * masthead light at the same relative height here as it is in the 2D
 * views; anything else and the same light would sit at two different
 * heights depending on which tab you were on.
 */
export const LIGHT_Z_TO_X = 150 / 185;

export function lightPosition(
  light: { fx: number; py: number; z: number },
  lengthMeters: number,
): [number, number, number] {
  // fx and py share one scale — the plan view plots both against
  // HULL_SCALE — so athwartships needs no separate beam figure.
  const halfLength = lengthMeters / 2;
  return [light.fx * halfLength, light.z * halfLength * LIGHT_Z_TO_X, light.py * halfLength];
}

// --- Anchoring lights to the mesh -----------------------------------------
//
// lightPosition() puts a light where the idealized 2D profile would, which
// is nowhere in particular on a stand-in mesh whose proportions are a
// cartoon's (searoom#22): a sidelight floats off the shoulder, a masthead
// light sits inside the cabin. The fix is to read the hull's shape back
// out of the mesh — a station profile, as a naval architect would draw
// one — and seat each light on the surface at a point that makes sense
// for that light on that hull.

/**
 * The hull's shape sampled fore-aft: `stations` bins of equal width from
 * `minX` to `maxX` (world metres, bow on +X), each recording the widest
 * point, the height of the hull's edge there, and the highest point of
 * anything at that station. Arrays run stern to bow. `mast` is the
 * tallest structure — on a tug, the funnel — as the fore-aft extent of
 * everything within MAST_BAND of the mesh's highest point.
 */
export interface StationProfile {
  minX: number;
  maxX: number;
  /** Max |z| (half-beam) per station. */
  halfBeam: number[];
  /** Max y among vertices out at the beam edge: the gunwale or sheer. */
  deck: number[];
  /** Max y of anything at the station: deck, cabin roof, funnel, mast. */
  top: number[];
  mast: { aftX: number; foreX: number; top: number };
}

export interface Station {
  halfBeam: number;
  deck: number;
  top: number;
}

export const PROFILE_STATIONS = 24;

/**
 * A vertex counts as "at the beam edge" when it is at least this fraction
 * of the station's half-beam outboard. Wide enough to catch a low-poly
 * gunwale, narrow enough to exclude a cabin side set in from the rail —
 * which is exactly the surface a sidelight must not be lifted onto.
 */
export const DECK_EDGE_BAND = 0.9;

/**
 * Points at least this fraction of the mesh's height up are "the mast".
 * 0.9 read a long flat-topped deckhouse (a bridge, not a mast) as the mast
 * on more than half of a 33-hull sample; 0.95 recovers most of them
 * without losing a genuine mast or funnel, which sits well clear of the
 * next-tallest structure on every hull checked (nav-wright#36).
 */
export const MAST_BAND = 0.95;

/**
 * Densify a triangle mesh for profiling: the vertices plus points along
 * every edge no more than `spacing` apart. A low-poly mesh puts a whole
 * cabin roof in one quad, so a station in the middle of that roof sees
 * no vertex at all and reads as open deck; sampling the edges fills the
 * gap. `index` is the triangle list (three vertex indices per face); with
 * no index the vertices are taken as an unindexed triangle list.
 */
export function sampleEdges(
  xyz: ArrayLike<number>,
  index: ArrayLike<number> | null,
  spacing: number,
): number[] {
  const out: number[] = Array.from(xyz as ArrayLike<number>);
  if (!(spacing > 0)) return out;
  const n = Math.floor(xyz.length / 3);
  const tri = (i: number): number => (index ? index[i] : i);
  const faces = Math.floor((index ? index.length : n) / 3);
  const seen = new Set<number>();
  for (let f = 0; f < faces; f++) {
    const ids = [tri(f * 3), tri(f * 3 + 1), tri(f * 3 + 2)];
    for (let e = 0; e < 3; e++) {
      const a = ids[e];
      const b = ids[(e + 1) % 3];
      const key = a < b ? a * n + b : b * n + a;
      if (seen.has(key)) continue;
      seen.add(key);
      const ax = xyz[a * 3],
        ay = xyz[a * 3 + 1],
        az = xyz[a * 3 + 2];
      const dx = xyz[b * 3] - ax,
        dy = xyz[b * 3 + 1] - ay,
        dz = xyz[b * 3 + 2] - az;
      const len = Math.hypot(dx, dy, dz);
      const steps = Math.ceil(len / spacing);
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        out.push(ax + t * dx, ay + t * dy, az + t * dz);
      }
    }
  }
  return out;
}

/**
 * Bin the mesh's points fore-aft into a StationProfile. `xyz` is a flat
 * world-space [x0, y0, z0, x1, ...] array in the same frame the lights use
 * (bow +X, up +Y, starboard +Z), i.e. after the hull placement has been
 * applied — and ideally after sampleEdges(). Returns null when there is
 * nothing to profile.
 *
 * A station with no points borrows from its neighbours by linear
 * interpolation, so a light can always be seated somewhere plausible
 * rather than on a zero-beam ghost hull.
 */
export function stationProfile(
  xyz: ArrayLike<number>,
  stations = PROFILE_STATIONS,
): StationProfile | null {
  const n = Math.floor(xyz.length / 3);
  if (n === 0 || stations < 1) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = xyz[i * 3];
    const y = xyz[i * 3 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const span = maxX - minX;
  if (!(span > 0)) return null;

  const binOf = (x: number): number =>
    Math.min(stations - 1, Math.max(0, Math.floor(((x - minX) / span) * stations)));

  const halfBeam = new Array<number>(stations).fill(0);
  const top = new Array<number>(stations).fill(-Infinity);
  const deck = new Array<number>(stations).fill(-Infinity);
  const count = new Array<number>(stations).fill(0);
  const mast = { aftX: Infinity, foreX: -Infinity, top: maxY };
  const mastFloor = MAST_BAND * maxY;

  // Two passes: half-beam first, because "at the beam edge" is defined
  // relative to it.
  for (let i = 0; i < n; i++) {
    const x = xyz[i * 3];
    const b = binOf(x);
    const y = xyz[i * 3 + 1];
    const z = Math.abs(xyz[i * 3 + 2]);
    count[b]++;
    if (z > halfBeam[b]) halfBeam[b] = z;
    if (y > top[b]) top[b] = y;
    if (y >= mastFloor) {
      if (x < mast.aftX) mast.aftX = x;
      if (x > mast.foreX) mast.foreX = x;
    }
  }
  for (let i = 0; i < n; i++) {
    const b = binOf(xyz[i * 3]);
    const y = xyz[i * 3 + 1];
    const z = Math.abs(xyz[i * 3 + 2]);
    if (z >= DECK_EDGE_BAND * halfBeam[b] && y > deck[b]) deck[b] = y;
  }

  fillEmptyStations(count, halfBeam);
  fillEmptyStations(count, top);
  fillEmptyStations(count, deck);

  return { minX, maxX, halfBeam, deck, top, mast };
}

/** Replace the values of empty stations by interpolating between the
 * nearest filled neighbours, extending the end values outward. */
function fillEmptyStations(count: number[], values: number[]): void {
  const filled: number[] = [];
  for (let i = 0; i < count.length; i++) if (count[i] > 0) filled.push(i);
  if (filled.length === 0 || filled.length === count.length) return;
  for (let i = 0; i < count.length; i++) {
    if (count[i] > 0) continue;
    let lo = -1;
    let hi = -1;
    for (const f of filled) {
      if (f < i) lo = f;
      if (f > i && hi === -1) hi = f;
    }
    if (lo === -1) values[i] = values[hi];
    else if (hi === -1) values[i] = values[lo];
    else {
      const t = (i - lo) / (hi - lo);
      values[i] = values[lo] + t * (values[hi] - values[lo]);
    }
  }
}

/** World x of station i's centre. */
function stationX(profile: StationProfile, i: number): number {
  const width = (profile.maxX - profile.minX) / profile.halfBeam.length;
  return profile.minX + (i + 0.5) * width;
}

/** The hull's cross-section at world x, interpolated between station
 * centres and clamped to the ends of the profile. */
export function stationAt(profile: StationProfile, x: number): Station {
  const n = profile.halfBeam.length;
  const width = (profile.maxX - profile.minX) / n;
  // Position in station units, measured from the first station's centre.
  const u = Math.min(n - 1, Math.max(0, (x - profile.minX) / width - 0.5));
  const i = Math.floor(u);
  const j = Math.min(n - 1, i + 1);
  const t = u - i;
  const lerp = (a: number[]): number => a[i] + t * (a[j] - a[i]);
  return {
    halfBeam: lerp(profile.halfBeam),
    deck: lerp(profile.deck),
    top: lerp(profile.top),
  };
}

/**
 * Where the bow starts to narrow: the half-beam has fallen to this
 * fraction of the hull's widest. Sidelights go here, as on a small craft,
 * where the flare of the bow itself gives them their 112.5° arc.
 */
export const BOW_SHOULDER = 0.8;

/** World x of the bow shoulder: the forward-most point at which the
 * half-beam is still BOW_SHOULDER of the maximum. */
export function bowShoulder(profile: StationProfile): number {
  const hb = profile.halfBeam;
  const n = hb.length;
  const threshold = BOW_SHOULDER * Math.max(...hb);
  for (let i = n - 1; i >= 0; i--) {
    if (hb[i] < threshold) continue;
    if (i === n - 1) return stationX(profile, i);
    // Crossing between station i (wide enough) and i + 1 (too narrow).
    const t = (hb[i] - threshold) / (hb[i] - hb[i + 1]);
    return stationX(profile, i) + t * (stationX(profile, i + 1) - stationX(profile, i));
  }
  return stationX(profile, n - 1);
}

/**
 * Athwartships offset, as a multiple of the hull's half-beam, at or
 * beyond which a light is treated as sitting on the hull's side — a
 * sidelight. Below it the light is on the centreline (or a tricolour's
 * twin halves either side of it); above it the light hangs outboard of
 * the hull on a yard and keeps its height.
 */
export const SIDE_LIGHT_BAND: [number, number] = [0.8, 1.2];

export interface LightSeat {
  fx: number;
  py: number;
  z: number;
}

/** The hull spec's stations that placeLights keys lights on, in fx/py
 * units: enough to recognise "this light is on the mast" without a
 * light having to say so. `sternX` and `bowX` are also the span the mesh
 * is fitted to (see HullSpan). */
export interface HullStations extends HullSpan {
  /** Half-beam. */
  beam: number;
  mastX: number;
  aftMastX: number;
  /** Mast heights, z units: with the lights, the vessel's own height, which
   * frames the view (viewFrame). */
  mastTopZ?: number;
  aftMastTopZ?: number;
}

/**
 * Where each light sits on the mesh, in the same world as lightPosition():
 * one position per input light, in order.
 *
 * - A sidelight (|py| within SIDE_LIGHT_BAND of the half-beam) goes to
 *   the bow shoulder, on the rail at deck height, `clearance` above it.
 * - Lights on the hull's mast (fx = mastX) go to the front edge of the
 *   mesh's tallest structure — the funnel, on this tug — at its top;
 *   lights on the aft mast (fx = aftMastX) go to its aft edge, and the
 *   two share one lift so the aft masthead light stays higher than the
 *   forward one by the same margin the 2D profile gives it.
 * - Lights at the stern (fx = sternX) go to the aftmost point of the
 *   hull, on the transom's top edge.
 * - Every other light keeps its analytic station, and athwartships every
 *   light keeps its offset as a fraction of the half-beam, so a yard-end
 *   light hangs the same proportion outboard as in the 2D views.
 * - Except for sidelights, the lights sharing a station are lifted
 *   together — by however much the lowest of them needs — to clear the
 *   top of whatever the mesh has there. Together, so a vertical stack
 *   stays a stack with its spacing intact.
 *
 * Pure: no three.js, and the mesh is only present as its profile.
 */
export function anchorLights(
  lights: LightSeat[],
  lengthMeters: number,
  hull: HullStations,
  profile: StationProfile,
  clearance = 0,
): [number, number, number][] {
  const { beam } = hull;
  const analytic = lights.map((l) => lightPosition(l, lengthMeters));
  const same = (a: number, b: number): boolean => Math.abs(a - b) < 1e-6;

  const isSide = (l: LightSeat): boolean => {
    if (!(beam > 0)) return false;
    const r = Math.abs(l.py) / beam;
    return r >= SIDE_LIGHT_BAND[0] && r <= SIDE_LIGHT_BAND[1];
  };

  // Where each light's station lands on the mesh, and how high the mesh
  // is there.
  const shoulderX = bowShoulder(profile);
  const seat = lights.map((l, i): { x: number; top: number; mast: boolean } => {
    if (isSide(l)) return { x: shoulderX, top: 0, mast: false };
    if (same(l.fx, hull.mastX)) return { x: profile.mast.foreX, top: profile.mast.top, mast: true };
    if (same(l.fx, hull.aftMastX))
      return { x: profile.mast.aftX, top: profile.mast.top, mast: true };
    if (same(l.fx, hull.sternX))
      return { x: profile.minX, top: stationAt(profile, profile.minX).top, mast: false };
    const x = analytic[i][0];
    return { x, top: stationAt(profile, x).top, mast: false };
  });

  // Lift per station group: keyed on fx, since that is what placeLights
  // shares between the members of a stack. Both masts share one key.
  const groupKey = (l: LightSeat, i: number): string =>
    seat[i].mast ? 'mast' : String(Math.round(l.fx * 1000));
  const lift = new Map<string, number>();
  lights.forEach((l, i) => {
    if (isSide(l)) return;
    const key = groupKey(l, i);
    const need = seat[i].top + clearance - analytic[i][1];
    lift.set(key, Math.max(lift.get(key) ?? 0, need, 0));
  });

  return lights.map((l, i) => {
    const { x } = seat[i];
    const s = stationAt(profile, x);
    const z = beam > 0 ? (l.py / beam) * s.halfBeam : 0;
    if (isSide(l)) return [x, s.deck + clearance, z];
    return [x, analytic[i][1] + (lift.get(groupKey(l, i)) ?? 0), z];
  });
}

/** The lights the 3D view draws for a viewer at relative bearing `theta`,
 * each with its seat (`seats[i]` belongs to `lights[i]`; missing seats
 * stay undefined). Seated first, culled second, so a light's seat never
 * moves as the viewer walks round; only whether it is lit changes. */
export function seatsSeenFrom(
  lights: readonly PlacedLight[],
  seats: readonly ([number, number, number] | undefined)[] | null,
  theta: number,
): { light: PlacedLight; position: [number, number, number] | undefined }[] {
  return lightsInView(
    lights.map((light, i) => ({ light, arc: light.arc, position: seats?.[i] })),
    theta,
  ).map(({ light, position }) => ({ light, position }));
}

// --- Framing the view -----------------------------------------------------
//
// The hull is placed and lit in metres, then drawn in view units: viewFrame()
// scales and centres the scene from the vessel — her length and her spec's
// own heights and beam — never from the mesh. So the frame is the same
// whichever mesh is drawn for her (her own, or Benchy swapped in), and a mesh
// swap changes nothing on screen but the mesh: same length, same place. The
// camera's frame never changes either, so a camera the viewer has dragged
// never needs re-seating.

/** The camera's frame, in view units, looking at the origin. */
export const VIEW_FRAME = {
  fov: 40,
  /** The canvas's width over its height: `.scene-3d-stack` in style.css. */
  aspect: 440 / 240,
  distance: 1.6,
  minDistance: 0.6,
  maxDistance: 8,
  near: 0.01,
  far: 40,
} as const;

/**
 * Headroom every frame keeps above the waterline, as a fraction of her
 * length. A spec's masts stand at most ~0.45 of her length, but a mesh can
 * stand taller than the profile it fits — Benchy, which may be drawn in
 * place of any vessel, is about 0.75 of it, and the Kenney sailing hulls'
 * masts nearly 1.0 — and lights are seated on top of the mesh. The frame
 * cannot ask the mesh (a swap must not move it), so it holds the tallest
 * mesh shipped for a hull; test/viewFrame.test.ts checks every one. A
 * mesh taller still, a traced rig, says so through her catalog record
 * (meshTopZ, framedTo).
 */
export const FRAME_HEADROOM = 0.85;

/** How far inside the canvas edge the frame stays, as a fraction of the
 * half-width or half-height. */
export const FRAME_MARGIN = 0.9;

/** The vessel, in fx/py/z units, as viewFrame() reads her. A HullSpec fits. */
export interface FrameSpec extends HullSpan {
  /** Half-beam. */
  beam: number;
  mastTopZ?: number;
  aftMastTopZ?: number;
}

export interface ViewFit {
  /** View units per metre. */
  scale: number;
  /** Translation applied after the scale, as [x, y, z]. */
  position: [number, number, number];
}

const finite = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** The vessel's envelope at length 1, in metres-per-metre: bow on +X, up
 * on +Y, starboard on +Z. From the spec and its lights, never a mesh. */
export function frameBox(
  spec: FrameSpec,
  lights: readonly { fx: number; py: number; z: number }[] = [],
): ModelBox {
  const spanned = finite(spec.sternX) && finite(spec.bowX) && spec.bowX > spec.sternX;
  const xs = [spanned ? spec.sternX : -1, spanned ? spec.bowX : 1, ...lights.map((l) => l.fx)];
  const ys = [
    finite(spec.beam) && spec.beam > 0 ? spec.beam : 0.25,
    ...lights.map((l) => Math.abs(l.py)),
  ];
  const zs = [spec.mastTopZ, spec.aftMastTopZ, ...lights.map((l) => l.z)].filter(finite);
  // A light's halo reaches this far past its seat (SceneLight: 2.6 beads).
  const pad = lightRadius(1) * 2.6;
  const halfBeam = Math.max(...ys) / 2 + pad;
  const top = Math.max(FRAME_HEADROOM, (Math.max(0, ...zs) / 2) * LIGHT_Z_TO_X + pad);
  return {
    min: { x: Math.min(...xs) / 2 - pad, y: 0, z: -halfBeam },
    max: { x: Math.max(...xs) / 2 + pad, y: top, z: halfBeam },
  };
}

/** The top of a mesh above the waterline in z units, from the catalog's
 * measured length over height (docs/design/mesh-catalog.md): placed as a
 * vessel of length L she stands 2 / lengthHeight half-lengths tall, and z
 * counts LIGHT_Z_TO_X per half-length. */
export function meshTopZ(lengthHeight: number): number {
  return 2 / (lengthHeight * LIGHT_Z_TO_X);
}

/** `spec` with its mast raised to `topZ` when the mesh stands taller than
 * the drawing, so viewFrame holds her rig; the spec itself is untouched. */
export function framedTo<T extends FrameSpec>(spec: T, topZ?: number): T {
  if (!finite(topZ) || !(topZ > (spec.mastTopZ ?? 0))) return spec;
  return { ...spec, mastTopZ: topZ };
}

/** Tilts and bearings the frame is checked from: every whole bearing in
 * steps of FRAME_STEP degrees and every tilt in [MIN_TILT, MAX_TILT]. */
const FRAME_STEP = 3;

/**
 * The camera distance, in units of her length, at which `box` (frameBox's,
 * at length 1) stays inside FRAME_MARGIN of the canvas from every bearing
 * and tilt, the camera looking at `target`.
 */
export function frameDistance(box: ModelBox, target: Vec3): number {
  const DEG = Math.PI / 180;
  const tanV = Math.tan((VIEW_FRAME.fov / 2) * DEG) * FRAME_MARGIN;
  const tanH = tanV * VIEW_FRAME.aspect;
  const corners: Vec3[] = [];
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        corners.push({ x: x - target.x, y: y - target.y, z: z - target.z });
  let need = 0;
  const tilts: number[] = [];
  for (let t = MIN_TILT; t < MAX_TILT; t += FRAME_STEP) tilts.push(t);
  tilts.push(MAX_TILT);
  for (let theta = 0; theta < 360; theta += FRAME_STEP) {
    for (const tilt of tilts) {
      // u: origin to camera; r and v: the screen's right and up.
      const [ux, uy, uz] = orbitPosition(theta, tilt, 1);
      // From theta, not from u, which is zero here at the poles.
      const rx = Math.sin(theta * DEG);
      const rz = -Math.cos(theta * DEG);
      // v = u x r, the screen's up.
      const vx = uy * rz;
      const vy = uz * rx - ux * rz;
      const vz = -uy * rx;
      for (const c of corners) {
        const toward = c.x * ux + c.y * uy + c.z * uz;
        const across = Math.abs(c.x * rx + c.z * rz);
        const up = Math.abs(c.x * vx + c.y * vy + c.z * vz);
        need = Math.max(need, toward + across / tanH, toward + up / tanV);
      }
    }
  }
  return need;
}

/**
 * How to draw a vessel of `lengthMeters` in view units: scaled so her frame
 * (frameBox: her spec's span, beam and mast and light heights, with
 * FRAME_HEADROOM above the waterline) fills the canvas from VIEW_FRAME's
 * camera without leaving it from any bearing or tilt, and centred on
 * midships, half the frame's height above the waterline — the point the
 * camera orbits. Her length on screen depends on her spec's proportions
 * and not on her length, and never on the mesh drawn for her.
 *
 * A nonsense length draws the scene as it is.
 */
export function viewFrame(
  lengthMeters: number,
  spec: FrameSpec,
  lights: readonly { fx: number; py: number; z: number }[] = [],
): ViewFit {
  if (!(lengthMeters > 0) || !Number.isFinite(lengthMeters))
    return { scale: 1, position: [0, 0, 0] };
  const box = frameBox(spec, lights);
  const target = { x: 0, y: box.max.y / 2, z: 0 };
  const scale = VIEW_FRAME.distance / (frameDistance(box, target) * lengthMeters);
  return { scale, position: [0, -scale * target.y * lengthMeters, 0] };
}

/** Bead radius for a light in metres, and how far off the surface it is
 * seated: a fixed fraction of her length, so it too holds its size. */
export function lightRadius(lengthMeters: number): number {
  return lengthMeters * 0.012;
}

/** Where the camera sits, in view units, for a viewer at relative bearing
 * `theta` and elevation `tilt` (degrees), `distance` from the origin.
 * theta 0 = seen from ahead (+X, the bow), 90 = from her starboard beam
 * (+Z), matching the bearing view's aspects; tilt is clamped to
 * [MIN_TILT, MAX_TILT]. */
export function orbitPosition(
  theta: number,
  tilt: number,
  distance: number = VIEW_FRAME.distance,
): [number, number, number] {
  const DEG = Math.PI / 180;
  const polar = (90 - Math.min(MAX_TILT, Math.max(MIN_TILT, tilt))) * DEG;
  const rad = theta * DEG;
  return [
    distance * Math.sin(polar) * Math.cos(rad),
    distance * Math.cos(polar),
    distance * Math.sin(polar) * Math.sin(rad),
  ];
}

/** The inverse of orbitPosition, from OrbitControls' angles (radians) to
 * whole degrees: theta in 0..359, tilt from the waterline. three's
 * azimuthal angle runs from +Z toward +X, so theta 0 (camera on +X) is its
 * 90 degrees; its polar angle is from straight up. */
export function orbitAngles(azimuthal: number, polar: number): { theta: number; tilt: number } {
  const DEG = Math.PI / 180;
  const theta = Math.round(90 - azimuthal / DEG);
  return {
    theta: ((theta % 360) + 360) % 360,
    tilt: Math.round(90 - polar / DEG),
  };
}
