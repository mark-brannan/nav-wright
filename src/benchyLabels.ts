// The 3D bearing view's labels. Deliberately an extension of SceneLabels
// rather than more fields on it: the 3D view ships from its own subpath
// (nav-wright/benchy), and a consumer who only renders the SVG views should
// not have to supply labels for a control they never mount. The view passes
// the whole object down to the SVG bearing scene, its 2D stand-in, which is
// why this extends rather than stands alone.

import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';

export interface BenchyLabels extends SceneLabels {
  benchyTiltLabel: string;
  benchyTiltValue: (tilt: number) => string;
}

export const defaultBenchyLabels: BenchyLabels = {
  ...defaultSceneLabels,
  benchyTiltLabel: 'Tilt',
  benchyTiltValue: (tilt) => `${tilt} degrees above the waterline`,
};
