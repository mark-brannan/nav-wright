// The public surface of nav-wright/benchy: the 3D scene view.
//
// Its own entry point so `nav-wright` stays free of three.js. Everything
// reachable from here may pull in three, @react-three/fiber and
// @react-three/drei — which are optional peer dependencies, installed
// only by a consumer who imports this subpath.
//
// BenchyModel itself is deliberately not re-exported: it lives behind
// BenchyView's lazy() boundary, and naming it here would load three.js
// eagerly for anyone importing this module and undo the split.

// The scene view
export { BenchyView } from './BenchyView.js';

// Camera elevation: the range TiltControl and a consumer's URL state
// clamp against
export { DEFAULT_TILT, MAX_TILT } from './tilt.js';

// The controls, for a consumer laying out its own chrome
export { TiltControl } from './TiltControl.js';

// Degrading a failed model load to something other than a blank pane
export { ModelErrorBoundary } from './ModelErrorBoundary.js';

// Warming the model cache ahead of mounting (three.js loads on call, not
// on import)
export { preloadBenchyModel } from './preload.js';

// Scene labels for the 3D view: SceneLabels plus the canvas's own
export { defaultBenchyLabels } from './benchyLabels.js';
export type { BenchyLabels } from './benchyLabels.js';
