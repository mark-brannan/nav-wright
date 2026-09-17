// The public surface of nav-wright/profile: the pure station-profile API
// BenchyModel's Hull is built from, plus the scene -> StationProfile
// pipeline itself — for a consumer's own registration test, built exactly
// as the view builds it (nav-wright#38).
//
// `three` is a peer dependency of `profileHullModel` but nothing here
// touches React or @react-three/fiber/drei, so this entry point loads
// under a plain Node test runner: no DOM, no canvas.

// Placing a hull model in the scene, and reading its shape back
export {
  anchorLights,
  bowShoulder,
  lightPosition,
  placeHullModel,
  sampleEdges,
  stationAt,
  stationProfile,
  LIGHT_Z_TO_X,
  PROFILE_STATIONS,
} from './modelTransform.js';
export type { HullStations, StationProfile } from './modelTransform.js';

// The scene -> profile pipeline BenchyModel's Hull runs: the same function,
// not a copy of its ~40 lines
export { profileHullModel } from './hullProfile.js';
