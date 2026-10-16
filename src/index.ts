// The public surface of nav-wright. Names are exactly the ones the modules
// carry inside searoom, where they were built; extraction is not the moment
// to rename anything.

// Rendering primitives
export { Glow, LIGHT_COLORS, lightFill, polar, sectorPath } from './svg.js';

// Vessel models
export { PX, PZ, allHulls, selectHull } from './hulls.js';
export type { Hull, HullSpec } from './hulls.js';

// Light placement and arc geometry
export { bearingInArc, lightsInView, placeLights } from './placement.js';
export type { PlacedLight } from './placement.js';

// Scene labels (the i18n seam: English defaults, consumer-supplied catalog)
export { defaultSceneLabels } from './labels.js';
export type { Aspect, SceneLabels } from './labels.js';

// Naming a relative bearing
export { bearingLabel } from './bearing.js';

// Scene views
export { BearingView, SKY_LIGHT, skyColor } from './BearingView.js';
export { PlanView } from './PlanView.js';
export { ProfileView } from './ProfileView.js';
export { SceneView } from './SceneView.js';
export type { SceneVessel } from './SceneView.js';
export { fitScale, pairLayout, toScreen } from './sceneGeometry.js';
export type { PairInput, PairLayout } from './sceneGeometry.js';

// The relative-bearing dial, shared by BearingView and the 3D view, and the
// drag-to-rotate gesture behind it; θ wraps through 359 back to 0
export { ThetaControl } from './ThetaControl.js';
export { thetaAfterDrag, thetaAtPoint, useDragRotate, wrapDegrees } from './rotate.js';

// The 3D scene view ships from its own entry point, `nav-wright/benchy`,
// so three.js stays out of this one. The station-profile math it's built
// on, plus the scene-to-profile pipeline, ships from `nav-wright/profile`
// instead — no React or @react-three/fiber there, only three.js.
