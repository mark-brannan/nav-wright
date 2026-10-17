// The bearing view and the 3D model in one: the vessel as a mesh you can
// grab and swing round, at night, with only the lights a viewer at that
// relative bearing would see. The exam's meaning is BearingView's: a light
// outside its arc is not drawn, whatever the mesh shows. The hull is a hint,
// faded by `hullHint` (0 is lights only) and by range, as in the 2D view.
//
// Falls back to the 2D BearingView, same props, if the model or WebGL fails:
// the fallback keeps the exam's meaning, where the Benchy view's profile
// fallback would not. While three.js or the model loads, the 2D bearing
// scene stands in on the canvas, so the lights are never a blank wait.

import { Suspense, useState } from 'react';
import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';
import { BearingScene, BearingView, hullHintOpacity, skyColor } from './BearingView.js';
import type { Hull } from './hulls.js';
import { LazyBenchyModel } from './lazyModel.js';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import { lightsInView } from './placement.js';
import type { BenchyLabels } from './benchyLabels.js';
import { defaultBenchyLabels } from './benchyLabels.js';
import type { SilhouetteVariant } from './silhouette.js';
import { DEFAULT_TILT } from './tilt.js';
import { ThetaControl } from './ThetaControl.js';
import { TiltControl } from './TiltControl.js';

/** The mesh's opacity for a hull hint strength 0..1 at a range in nm. */
export function bearingHullOpacity(hullHint: number, rangeNm?: number): number {
  const s = Number.isFinite(hullHint) ? Math.min(1, Math.max(0, hullHint)) : 0;
  return s * hullHintOpacity(rangeNm);
}

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
  seascape = false,
  silhouette,
  labels = defaultBenchyLabels,
}: {
  /** URL of the hull's .glb; a consumer resolves one per hull (see BenchyView). */
  modelUrl: string;
  hull: Hull;
  placed: PlacedLight[];
  facts: FactRecord;
  /** Relative bearing of the viewer, degrees. Decides which lights show. */
  theta: number;
  onTheta: (t: number) => void;
  /** Camera elevation above the waterline, degrees. Never changes which
   *  lights show: arcs are horizontal. */
  tilt?: number;
  onTilt?: (t: number) => void;
  /** Hull visibility, 0 (lights only) .. 1 (plain to see); range fades it further. */
  hullHint: number;
  /** Range to her in nautical miles; fades the hull (see hullHintOpacity). */
  range?: number;
  /** Background, 0 (black) .. 1 (a lighter night blue). See skyColor. */
  sky?: number;
  /** A sea at the waterline, as BearingView's seascape. Default: none. */
  seascape?: boolean;
  /** Draw her as a flat silhouette from the waterline's level (tilt 0)
   * rather than a shaded model; see SilhouetteVariant. The hull hint, range,
   * sky and sea apply alike. Default: the model. */
  silhouette?: SilhouetteVariant;
  labels?: BenchyLabels;
}): ReactElement {
  const [modelFailed, setModelFailed] = useState(false);

  const flat = (
    <BearingView
      hull={hull}
      placed={placed}
      theta={theta}
      onTheta={onTheta}
      hullHint={hullHint}
      range={range}
      sky={sky}
      seascape={seascape}
      labels={labels}
    />
  );
  if (modelFailed) return flat;

  const lengthMeters = typeof facts['fact:length_m'] === 'number' ? facts['fact:length_m'] : 12;
  const background = skyColor(sky);
  const standIn = (
    <BearingScene
      hull={hull}
      placed={placed}
      theta={theta}
      onTheta={onTheta}
      hullHint={hullHint}
      range={range}
      sky={sky}
      seascape={seascape}
      labels={labels}
    />
  );
  const blank = <div className="scene-3d" style={{ background }} aria-hidden="true" />;
  const noneInView = lightsInView(placed, theta).length === 0;

  return (
    <ModelErrorBoundary fallback={flat} onError={() => setModelFailed(true)}>
      <div className="bearing-view model-view">
        <div
          className="scene-3d-stack scene-3d-night"
          role="img"
          aria-label={labels.bearingAlt(Math.round(theta))}
          style={{ background }}
        >
          <Suspense fallback={standIn}>
            <LazyBenchyModel
              modelUrl={modelUrl}
              lengthMeters={lengthMeters}
              placed={placed}
              anchored={facts['fact:position'] === 'position:anchored'}
              theta={theta}
              onTheta={onTheta}
              tilt={tilt}
              onTilt={onTilt}
              hull={hull.spec}
              inViewAt={theta}
              hullOpacity={bearingHullOpacity(hullHint, range)}
              background={background}
              night
              silhouette={silhouette}
              blockSpec={hull.spec}
              seascape={seascape}
              label={labels.bearingAlt(Math.round(theta))}
              fallback={blank}
              loading={standIn}
              onError={() => setModelFailed(true)}
            />
          </Suspense>
          {noneInView && <p className="bearing-empty-overlay">{labels.bearingNoLights}</p>}
        </div>
        <ThetaControl theta={theta} onTheta={onTheta} labels={labels} plan={hull.plan} />
        {onTilt && !silhouette && <TiltControl tilt={tilt} onTilt={onTilt} labels={labels} />}
      </div>
    </ModelErrorBoundary>
  );
}
