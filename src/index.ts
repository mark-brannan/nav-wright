// The public surface of nav-wright. Names are exactly the ones the modules
// carry inside searoom, where they were built; extraction is not the moment
// to rename anything.

// Rendering primitives
export { Glow, LIGHT_COLORS, lightFill, polar, sectorPath } from './svg.js';

// Vessel models
export { PX, PZ, allHulls, selectHull } from './hulls.js';
export type { Hull, HullSpec } from './hulls.js';

// Light placement and arc geometry
export { bearingInArc, placeLights } from './placement.js';
export type { PlacedLight } from './placement.js';

// Scene labels (the i18n seam: English defaults, consumer-supplied catalog)
export { defaultSceneLabels } from './labels.js';
export type { Aspect, SceneLabels } from './labels.js';

// Scene views
export { BearingView, bearingLabel } from './BearingView.js';
export { PlanView } from './PlanView.js';
export { ProfileView } from './ProfileView.js';
