// The bearing view, in 3D: her lights as seen from relative bearing θ, over
// the vessel as an orbitable model. One view for both jobs. With the hull
// hint at 0 and the sky black it is the exam view, lights only on black;
// lift the hint and the model fades in under the same lights.
//
// Lights obey their arcs exactly as the SVG bearing view's do (both cull
// through lightsSeenFrom). While three.js or the model loads, and in place
// of a model that cannot load, the SVG bearing scene stands in, so the exam
// view is never lost to a slow network or a browser without WebGL.

import { lazy, Suspense, useState } from 'react';
import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';
import type { Hull } from './hulls.js';
import { BearingScene, hullHintOpacity, skyColor } from './BearingView.js';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import type { BenchyLabels } from './benchyLabels.js';
import { defaultBenchyLabels } from './benchyLabels.js';
import { DEFAULT_TILT } from './tilt.js';
import { ThetaControl } from './ThetaControl.js';
import { TiltControl } from './TiltControl.js';

// Lazy: three.js (and the model) only ship to a browser that actually
// opens this view, so the 2D views' bundle is untouched.
const BenchyModel = lazy(() =>
  import('./BenchyModel.js').then((m) => ({ default: m.BenchyModel })),
);

export function BearingModelView({
  modelUrl,
  hull,
  placed,
  facts,
  theta,
  onTheta,
  tilt = DEFAULT_TILT,
  onTilt,
  hullHint,
  range,
  sky = 0,
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
  /** Hull hint strength, 0 (lights only) .. 1 (the model solid); range fades it further. */
  hullHint: number;
  /** Range to her in nautical miles; fades the hull hint (see hullHintOpacity). */
  range?: number;
  /** Background, 0 (black, the exam default) .. 1 (a lighter night blue). See skyColor. */
  sky?: number;
  labels?: BenchyLabels;
}): ReactElement {
  const [modelFailed, setModelFailed] = useState(false);

  const flat = (
    <BearingScene
      hull={hull}
      placed={placed}
      theta={theta}
      onTheta={onTheta}
      hullHint={hullHint}
      range={range}
      sky={sky}
      labels={labels}
    />
  );
  const dial = <ThetaControl theta={theta} onTheta={onTheta} labels={labels} plan={hull.plan} />;

  if (modelFailed)
    return (
      <div className="bearing-view">
        {flat}
        {dial}
      </div>
    );

  const lengthMeters =
    typeof facts['fact:length_m'] === 'number' ? facts['fact:length_m'] : 12;

  // The outer boundary catches a failed chunk load for the lazy import,
  // which happens before BenchyModel's own boundary exists to catch it.
  return (
    <ModelErrorBoundary fallback={flat} onError={() => setModelFailed(true)}>
      <div className="bearing-view model-view">
        <Suspense fallback={flat}>
          <div className="scene-3d-stack">
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
              hullOpacity={Math.min(1, Math.max(0, hullHint)) * hullHintOpacity(range)}
              background={skyColor(sky)}
              label={labels.bearingAlt(Math.round(theta))}
              fallback={flat}
              loading={flat}
              onError={() => setModelFailed(true)}
            />
          </div>
        </Suspense>
        {dial}
        {onTilt && <TiltControl tilt={tilt} onTilt={onTilt} labels={labels} />}
      </div>
    </ModelErrorBoundary>
  );
}
