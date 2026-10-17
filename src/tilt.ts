// The 3D view's camera elevation: 0 is at the waterline, MAX_TILT looks
// straight down and MIN_TILT straight up from beneath, through the sea. A
// view from a little below the waterline is a good one, so there is no floor
// at 0. The poles are as far as one number can go without turning her upside
// down.
//
// Its own module, and free of three.js, so TiltControl and a consumer's URL
// state can both clamp against the same numbers without pulling the 3D
// entry in to do it.

export const DEFAULT_TILT = 10;
export const MAX_TILT = 90;
export const MIN_TILT = -90;
