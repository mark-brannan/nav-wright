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

import { Suspense, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';
import { BearingScene, BearingView, hullHintOpacity, seaColor, skyColor } from './BearingView.js';
import type { Hull } from './hulls.js';
import type { MeshRecord } from './meshRecord.js';
import { meshTopZ } from './modelTransform.js';
import { LazyBenchyModel } from './lazyModel.js';
import { ModelErrorBoundary } from './ModelErrorBoundary.js';
import type { PlacedLight } from './placement.js';
import { bearingInArc, lightsInView } from './placement.js';
import type { LightIntensity, SectorProfile } from './sectorProfile.js';
import { K_PRESCRIBED, rangeVisibility, sectorIntensity } from './sectorProfile.js';
import type { LightGlow } from './halo.js';
import { haloProfile } from './halo.js';
import { glowProfile } from './svg.js';
import { FLASH_ON_S, mergeLanterns } from './lantern.js';
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
  mesh,
  placed,
  facts,
  theta,
  onTheta,
  tilt = DEFAULT_TILT,
  onTilt,
  hullHint,
  range,
  sky = 0,
  sea = 0.1,
  silhouette,
  sectorProfile,
  rangeDropout = false,
  lightRangesNm,
  transmissivity = K_PRESCRIBED,
  glowSize = 1,
  glowFalloff = 0,
  rangeGlow = false,
  haze = 0,
  singleLantern = false,
  flashesPerMinute,
  flashOnSeconds = FLASH_ON_S,
  labels = defaultBenchyLabels,
  controls = true,
}: {
  /** URL of the hull's .glb; a consumer resolves one per hull (see BenchyView). */
  modelUrl: string;
  hull: Hull;
  /** The catalog record of the mesh at `modelUrl` (meshCatalog): the view is
   * framed to the mesh's own height, so a rig taller than the spec's masts
   * stays on the canvas. Without it the frame holds FRAME_HEADROOM. */
  mesh?: MeshRecord;
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
  /** The sea, always drawn above the waterline: 0 (black) .. 1 (deep navy). See seaColor. */
  sea?: number;
  /** Draw her as a flat silhouette from the waterline's level (tilt 0)
   * rather than a shaded model; see SilhouetteVariant. The hull hint, range,
   * sky and sea apply alike. Default: the model. */
  silhouette?: SilhouetteVariant;
  /** Annex I §9(a) edge profiles (see sectorProfile.ts): each light fades
   *  across its arc limits instead of cutting hard. 3D only; the 2D
   *  fallback keeps the hard cut. */
  sectorProfile?: SectorProfile;
  /** Annex I §8: a light past its luminous range (`lightRangesNm`, by
   *  lightId) at `range` fades out. 3D only. */
  rangeDropout?: boolean;
  /** Rule 22 range in nautical miles by lightId, from lights.json
   *  visibility. Used by rangeDropout and rangeGlow. */
  lightRangesNm?: Record<string, number>;
  /** Annex I §8's atmospheric transmissivity K, 0..1, per nautical mile:
   *  lower is thicker air, and rangeDropout loses a light sooner. Default
   *  K_PRESCRIBED, the value the luminous ranges are prescribed at. 3D only. */
  transmissivity?: number;
  /** The halo round each light, as a multiple of its original size
   *  (2.6 bead radii). Default 1. 3D only. */
  glowSize?: number;
  /** How the halo fades towards its edge: 0 (a flat disc, the original)
   *  .. 1 (fading from the centre out). Default 0. 3D only. */
  glowFalloff?: number;
  /** Scale each halo by the light's range (`lightRangesNm`, by lightId) and
   *  the viewing `range`, as BearingView's rangeGlow does. Default off:
   *  every halo alike. */
  rangeGlow?: boolean;
  /** Haze in the air, 0 (clear, the original) .. 1: widens each halo, up to
   *  three times, and softens it towards a full falloff. 3D only. */
  haze?: number;
  /** Draw a combined fixture (tricolor) as one lantern, in the colour facing
   *  the viewer, as BearingView does. Default off: one dot per sector. */
  singleLantern?: boolean;
  /** Flash rate in flashes per minute for flashing lights (see declaredFlashRate), as BearingView. Default: a 1.2 s period. */
  flashesPerMinute?: number;
  /** Seconds each flash stays lit, from the start of its period. 3D only. Default 0.35. */
  flashOnSeconds?: number;
  labels?: BenchyLabels;
  /** Draw the dial and elevation slider under the picture. False when the page places its own. */
  controls?: boolean;
}): ReactElement {
  const [modelFailed, setModelFailed] = useState(false);
  const lightIntensity = useMemo((): LightIntensity | undefined => {
    if (!sectorProfile && !rangeDropout && !singleLantern) return undefined;
    const base: LightIntensity = (light, at) =>
      (sectorProfile
        ? sectorIntensity(at, light.arc, sectorProfile)
        : Number(bearingInArc(at, light.arc))) *
      (rangeDropout ? rangeVisibility(lightRangesNm?.[light.lightId], range, transmissivity) : 1);
    if (!singleLantern) return base;
    // One lantern per combined fixture: of the members that show at this
    // bearing, only the one facing the viewer keeps its intensity.
    let kept: { at: number; keys: Set<string> } | undefined;
    return (light, at) => {
      if (kept?.at !== at) {
        const shown = placed.filter((l) => base(l, at) > 0);
        kept = { at, keys: new Set(mergeLanterns(shown, at).map((l) => l.key)) };
      }
      return kept.keys.has(light.key) ? base(light, at) : 0;
    };
  }, [sectorProfile, rangeDropout, lightRangesNm, range, transmissivity, singleLantern, placed]);
  const lightGlow = useMemo((): LightGlow | undefined => {
    if (glowSize === 1 && glowFalloff === 0 && !rangeGlow && haze === 0) return undefined;
    return (light) =>
      haloProfile({
        glowSize,
        glowFalloff,
        haze,
        glow: rangeGlow ? glowProfile(lightRangesNm?.[light.lightId], range) : undefined,
      });
  }, [glowSize, glowFalloff, rangeGlow, haze, lightRangesNm, range]);

  const flat = (
    <BearingView
      hull={hull}
      placed={placed}
      theta={theta}
      onTheta={onTheta}
      hullHint={hullHint}
      range={range}
      sky={sky}
      rangeGlow={rangeGlow}
      lightRangesNm={lightRangesNm}
      singleLantern={singleLantern}
      flashesPerMinute={flashesPerMinute}
      labels={labels}
      controls={controls}
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
      rangeGlow={rangeGlow}
      lightRangesNm={lightRangesNm}
      singleLantern={singleLantern}
      flashesPerMinute={flashesPerMinute}
      labels={labels}
    />
  );
  const blank = <div className="scene-3d" style={{ background }} aria-hidden="true" />;
  const noneInView = lightIntensity
    ? placed.every((l) => lightIntensity(l, theta) === 0)
    : lightsInView(placed, theta).length === 0;

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
              topZ={mesh ? meshTopZ(mesh.proportions.lengthHeight) : undefined}
              inViewAt={theta}
              hullOpacity={bearingHullOpacity(hullHint, range)}
              background={background}
              night
              sea={seaColor(sea)}
              lightIntensity={lightIntensity}
              lightGlow={lightGlow}
              flashesPerMinute={flashesPerMinute}
              flashOnSeconds={flashOnSeconds}
              silhouette={silhouette}
              blockSpec={hull.spec}
              label={labels.bearingAlt(Math.round(theta))}
              fallback={blank}
              loading={standIn}
              onError={() => setModelFailed(true)}
            />
          </Suspense>
          {noneInView && <p className="bearing-empty-overlay">{labels.bearingNoLights}</p>}
        </div>
        {controls && (
          <ThetaControl theta={theta} onTheta={onTheta} labels={labels} plan={hull.plan} />
        )}
        {controls && onTilt && !silhouette && (
          <TiltControl tilt={tilt} onTilt={onTilt} labels={labels} />
        )}
      </div>
    </ModelErrorBoundary>
  );
}
