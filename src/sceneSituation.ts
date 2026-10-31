// A colregs situation record (colregs ADR 0005: `self`, `other`, `pair`) read
// as SceneView's props. `self` is own ship, `other` the target. Reading only:
// the record's numbers become the frame, and nothing here classifies the
// encounter or says who gives way.
//
// θ for BearingView — what own ship sees of the target — is
// `bearingTheta(situationPair(s))`.

import type { Situation } from 'colregs-engine';
import type { SceneVessel, SceneViewProps } from './SceneView.js';
import { pairFromPositions, type PairInput } from './sceneGeometry.js';

/** What the record cannot supply: each vessel's drawing and its placed lights. */
export type SituationVessel = Pick<SceneVessel, 'hull' | 'placed'>;

const KN_TO_MPS = 1852 / 3600;
const wrap = (d: number): number => ((d % 360) + 360) % 360;
const num = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

/**
 * The pair geometry a situation states. Headings are `kin:heading_deg` on
 * both vessels and must be present. The target's relative bearing is
 * `self:geo:rel_bearing_deg`, else the reciprocal of
 * `other:geo:rel_bearing_deg`, else both `kin:position`s; the range is
 * `pair:geo:range_m`, else both positions. A stated value wins over the
 * positions because it is what the engine read.
 */
export function situationPair(s: Situation): PairInput {
  const ownHeading = num(s.self.kin?.['kin:heading_deg']);
  const targetHeading = num(s.other?.kin?.['kin:heading_deg']);
  if (ownHeading === undefined || targetHeading === undefined) {
    throw new Error('situationPair: self and other both need kin:heading_deg');
  }
  const ownPos = s.self.kin?.['kin:position'];
  const targetPos = s.other?.kin?.['kin:position'];
  const fromPositions =
    ownPos && targetPos
      ? pairFromPositions(ownPos, targetPos, ownHeading, targetHeading)
      : undefined;

  const selfRel = num(s.self.geo?.['geo:rel_bearing_deg']);
  const otherRel = num(s.other?.geo?.['geo:rel_bearing_deg']);
  // other's bearing of self, turned round: the true bearing of self from
  // other, plus 180, is the true bearing of other from self
  const relativeBearing =
    selfRel !== undefined
      ? wrap(selfRel)
      : otherRel !== undefined
        ? wrap(targetHeading + otherRel + 180 - ownHeading)
        : fromPositions?.relativeBearing;
  const rangeM = num(s.pair?.geo?.['geo:range_m']) ?? fromPositions?.rangeM;
  if (relativeBearing === undefined || rangeM === undefined) {
    throw new Error(
      'situationPair: needs geo:rel_bearing_deg and pair geo:range_m, or both kin:positions',
    );
  }
  return { ownHeading, targetHeading, relativeBearing, rangeM };
}

/**
 * SceneView's props from a situation record and the two vessels' drawings.
 * Speed is `kin:sog_kn`, drawn along the heading (the record carries no
 * course over ground). The CPA marker needs both `geo:cpa_m` and
 * `geo:tcpa_s`; the backdrop is `pair:env`. `labels` and `vectorMinutes` are
 * the caller's to add.
 */
export function situationToScene(
  s: Situation,
  vessels: { own: SituationVessel; target: SituationVessel },
): SceneViewProps {
  const pair = situationPair(s);
  const vessel = (v: SituationVessel, heading: number, sogKn: unknown): SceneVessel => {
    const kn = num(sogKn);
    return kn === undefined ? { ...v, heading } : { ...v, heading, speedMps: kn * KN_TO_MPS };
  };
  const props: SceneViewProps = {
    own: vessel(vessels.own, pair.ownHeading, s.self.kin?.['kin:sog_kn']),
    target: vessel(vessels.target, pair.targetHeading, s.other?.kin?.['kin:sog_kn']),
    relativeBearing: pair.relativeBearing,
    rangeM: pair.rangeM,
  };
  const cpaM = num(s.pair?.geo?.['geo:cpa_m']);
  const tcpaS = num(s.pair?.geo?.['geo:tcpa_s']);
  if (cpaM !== undefined && tcpaS !== undefined) props.cpa = { cpaM, tcpaS };
  const env = s.pair?.env;
  if (env) {
    props.env = {
      narrowChannel: env['env:narrow_channel'] === true,
      trafficLane: env['env:traffic_lane'] === true,
    };
  }
  return props;
}
