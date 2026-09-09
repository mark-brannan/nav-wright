// The Benchy view's labels. Deliberately an extension of SceneLabels
// rather than three more fields on it: the 3D view ships from its own
// subpath (nav-wright/benchy), and a consumer who only renders the SVG
// views should not have to supply an alt text for a canvas they never
// mount. BenchyView passes the whole object down to ProfileView for its
// 2D fallback, which is why this extends rather than stands alone.

import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';

export interface BenchyLabels extends SceneLabels {
  benchyAlt: string;
  benchyTiltLabel: string;
  benchyTiltValue: (tilt: number) => string;
}

export const defaultBenchyLabels: BenchyLabels = {
  ...defaultSceneLabels,
  benchyAlt:
    'Benchy view: the vessel as a 3D model with her lights, free to orbit',
  benchyTiltLabel: 'Tilt',
  benchyTiltValue: (tilt) => `${tilt} degrees above the waterline`,
};
