// The public surface of nav-wright. Names are exactly the ones the modules
// carry inside searoom, where they were built; extraction is not the moment
// to rename anything.

// Rendering primitives
export { Glow, LIGHT_COLORS, lightFill, polar, sectorPath } from './svg';

// Vessel models
export { PX, PZ, allHulls, selectHull } from './hulls';
export type { Hull, HullSpec } from './hulls';

// Light placement and arc geometry
export { bearingInArc, placeLights } from './placement';
export type { PlacedLight } from './placement';

// Scene labels (the i18n seam: English defaults, consumer-supplied catalog)
export { defaultSceneLabels } from './labels';
export type { Aspect, SceneLabels } from './labels';

// Scene views
export { BearingView, bearingLabel } from './BearingView';
export { PlanView } from './PlanView';
export { ProfileView } from './ProfileView';
