// The vessel as a 3D model, orbitable: drag to swing round her and tilt,
// right-drag to pan, wheel to zoom. The horizontal angle is the same
// relative bearing the bearing view carries, driven by the same slider, so
// moving between the two tabs keeps you standing in the same place.

import { lazy, Suspense, useState } from 'react';
import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';
import type { Hull } from './hulls.js';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import type { BenchyLabels } from './benchyLabels.js';
import { defaultBenchyLabels } from './benchyLabels.js';
import { ProfileView } from './ProfileView.js';
import { DEFAULT_TILT } from './tilt.js';
import { ThetaControl } from './ThetaControl.js';
import { TiltControl } from './TiltControl.js';

// Lazy: three.js (and the model) only ship to a browser that actually
// opens this view, so the 2D views' bundle is untouched.
const BenchyModel = lazy(() =>
  import('./BenchyModel.js').then((m) => ({ default: m.BenchyModel })),
);

export function BenchyView({
  modelUrl,
  hull,
  placed,
  facts,
  theta,
  onTheta,
  tilt = DEFAULT_TILT,
  onTilt,
  labels = defaultBenchyLabels,
}: {
  /** URL of the .glb to render. This package ships one at
   * `nav-wright/models/3dbenchy-lowpoly.glb`; resolve it the way your
   * bundler resolves assets and pass the result. */
  modelUrl: string;
  hull: Hull;
  placed: PlacedLight[];
  facts: FactRecord;
  theta: number;
  onTheta: (t: number) => void;
  /** Camera elevation above the waterline, degrees; see TiltControl. */
  tilt?: number;
  onTilt?: (t: number) => void;
  labels?: BenchyLabels;
}): ReactElement {
  // A failed model load degrades to the 2D profile rather than to a blank
  // pane: the lights are the subject of this app, so losing them is worse
  // than losing the hull rendering.
  const [modelFailed, setModelFailed] = useState(false);

  const svgProfile = (
    <ProfileView hull={hull} placed={placed} facts={facts} labels={labels} />
  );
  if (modelFailed) return svgProfile;

  const lengthMeters =
    typeof facts['fact:length_m'] === 'number' ? facts['fact:length_m'] : 12;

  // The outer boundary catches a failed chunk load for the lazy import,
  // which happens before BenchyModel's own boundary exists to catch it.
  return (
    <ModelErrorBoundary fallback={svgProfile} onError={() => setModelFailed(true)}>
      <div className="model-view">
        <div className="scene-3d-stack" role="img" aria-label={labels.benchyAlt}>
          <Suspense fallback={<div className="scene-3d" aria-hidden="true" />}>
            <BenchyModel
              modelUrl={modelUrl}
              lengthMeters={lengthMeters}
              placed={placed}
              anchored={facts['fact:position'] === 'position:anchored'}
              theta={theta}
              onTheta={onTheta}
              tilt={tilt}
              onTilt={onTilt}
              hull={hull.spec}
              label={labels.benchyAlt}
              fallback={<div className="scene-3d" aria-hidden="true" />}
              onError={() => setModelFailed(true)}
            />
          </Suspense>
        </div>
        <ThetaControl theta={theta} onTheta={onTheta} labels={labels} />
        {onTilt && <TiltControl tilt={tilt} onTilt={onTilt} labels={labels} />}
      </div>
    </ModelErrorBoundary>
  );
}
