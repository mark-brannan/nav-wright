// The 3D view's camera elevation: 0 is at the waterline, MAX_TILT is close
// to straight down. Nothing below the waterline — there is nothing to see
// there and the sliders would need a sign.
//
// Its own module, and free of three.js, so TiltControl and a consumer's URL
// state can both clamp against the same numbers without pulling the 3D
// entry in to do it.

export const DEFAULT_TILT = 10;
export const MAX_TILT = 85;
