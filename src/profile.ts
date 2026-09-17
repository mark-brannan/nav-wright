// The public surface of nav-wright/profile: the pure station-profile math
// plus the scene-to-profile pipeline, split from the main entry point
// (nav-wright#38) because profileHullModel() takes a three.js Object3D.
// Nothing here touches React or @react-three/fiber, so — like
// hullMeshCheck.test.ts already does for the acceptance gate — a consumer
// can run this under a plain Node vitest environment: build a
// StationProfile from a loaded scene exactly as BenchyModel's Hull does,
// and compare it against a HullSpec without copying the pipeline.

export {
  BOW_SHOULDER,
  DECK_EDGE_BAND,
  LIGHT_Z_TO_X,
  MAST_BAND,
  MODEL_ROTATION_X,
  PROFILE_STATIONS,
  SIDE_LIGHT_BAND,
  anchorLights,
  bowShoulder,
  lightPosition,
  placeHullModel,
  sampleEdges,
  stationAt,
  stationProfile,
} from './modelTransform.js';
export type {
  HullStations,
  LightSeat,
  ModelBox,
  ModelPlacement,
  Station,
  StationProfile,
  Vec3,
} from './modelTransform.js';

export { profileHullModel } from './sceneProfile.js';
