// The 3D model, behind lazy(): three.js (and the mesh) ship only to a
// browser that mounts a 3D view, so the 2D views' bundle is untouched.
// One wrapper shared by every view that draws it.

import { lazy } from 'react';

export const LazyBenchyModel = lazy(() =>
  import('./BenchyModel.js').then((m) => ({ default: m.BenchyModel })),
);
