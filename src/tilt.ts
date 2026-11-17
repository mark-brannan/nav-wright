// The 3D view's camera elevation: 0 is at the waterline, MAX_TILT looks
// straight down and MIN_TILT straight up from beneath, through the sea. A
// view from a little below the waterline is a good one, so there is no floor
// at 0. The poles are as far as one number can go without turning her upside
// down.
//
// The bearing view goes past them (#117): its tilt wraps like theta, round
// a great circle through both poles, and past a pole the camera stands on
// the far side, upside down. viewerAt says where that viewer stands.
//
// Its own module, and free of three.js, so TiltControl and a consumer's URL
// state can both clamp against the same numbers without pulling the 3D
// entry in to do it.

export const DEFAULT_TILT = 10;
export const MAX_TILT = 90;
export const MIN_TILT = -90;

/** A wrapping tilt's reach either way: past it, -WRAP_TILT is the same view. */
export const WRAP_TILT = 180;

/** `tilt` wrapped into (-180, 180], as theta wraps into 0..360. */
export function wrapTilt(tilt: number): number {
  if (!Number.isFinite(tilt)) return DEFAULT_TILT;
  const t = (((tilt + WRAP_TILT) % 360) + 360) % 360;
  return t === 0 ? WRAP_TILT : t - WRAP_TILT;
}

/** Where the viewer stands for an orbit at `theta` and a wrapping `tilt`. */
export interface ViewerAt {
  /** Relative bearing the camera stands at, 0..360: the bearing that
   *  decides which lights show. */
  bearing: number;
  /** Elevation above the waterline, MIN_TILT..MAX_TILT. */
  elevation: number;
  /** Past a pole: the camera's up points down, and the picture is upside down. */
  inverted: boolean;
}

/** The viewer at orbit heading `theta` and wrapping `tilt`, degrees. Within
 * the poles that is (theta, tilt); past one, the camera has gone over her
 * and stands at theta + 180, as high as it is short of the far horizon. */
export function viewerAt(theta: number, tilt: number): ViewerAt {
  const t = wrapTilt(tilt);
  const inverted = t > MAX_TILT || t < MIN_TILT;
  const heading = inverted ? theta + 180 : theta;
  return {
    bearing: ((heading % 360) + 360) % 360,
    elevation: inverted ? Math.sign(t) * WRAP_TILT - t : t,
    inverted,
  };
}

/** The orbit heading that puts the viewer at `bearing` while the camera is
 * over (or under) the pole as it is at `tilt`: viewerAt's inverse in theta,
 * for a dial that reads where the viewer stands. */
export function thetaFor(bearing: number, tilt: number): number {
  const heading = viewerAt(0, tilt).inverted ? bearing + 180 : bearing;
  return ((heading % 360) + 360) % 360;
}
