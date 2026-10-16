// A small label interface for the scene views (BearingView, PlanView,
// ProfileView), so they can render without an app IntlProvider around
// them. English defaults live here; a consumer (searoom's Sandbox) wires
// its own react-intl catalog by building a SceneLabels from useIntl and
// passing it down.

export type Aspect =
  | 'ahead'
  | 'starboard-bow'
  | 'starboard-beam'
  | 'starboard-quarter'
  | 'astern'
  | 'port-quarter'
  | 'port-beam'
  | 'port-bow';

export interface SceneLabels {
  bearingAlt: (theta: number) => string;
  bearingNoLights: string;
  bearingThetaLabel: string;
  bearingThetaValue: (theta: number, aspect: string) => string;
  aspect: Record<Aspect, string>;
  planAlt: string;
  /** SceneView's closest-point-of-approach marker */
  sceneCpa?: (cpaM: number, tcpaS: number) => string;
  /** SceneView's environment backdrop: aria text for each drawn group */
  envNarrowChannel?: string;
  envTrafficLane?: string;
  profileAlt: string;
  /** PlanView's day-shape legend (day mode only) */
  planShapesAlt?: string;
  /** the tow and pushed-group views' alt text */
  towPlanAlt?: string;
  towProfileAlt?: string;
  /** 24(a)(i)'s tow length against its threshold, e.g. "250 m tow, over 200 m" */
  towLength?: (lengthM: number, thresholdM: number | undefined) => string;
  /** the marker at the threshold, e.g. "200 m" */
  towThreshold?: (thresholdM: number) => string;
}

export const defaultSceneLabels: SceneLabels = {
  sceneCpa: (cpaM, tcpaS) => `CPA ${Math.round(cpaM)} m in ${Math.round(tcpaS)} s`,
  envNarrowChannel: 'Narrow channel: a water corridor between its banks',
  envTrafficLane: 'Traffic lane: a one-way lane with a separation line on its port side',
  bearingAlt: (theta) => `Bearing view: her lights as seen from relative bearing ${theta} degrees`,
  bearingNoLights: 'No lights visible from this bearing',
  bearingThetaLabel: 'Relative bearing θ',
  bearingThetaValue: (theta, aspect) => `${theta} degrees, ${aspect}`,
  aspect: {
    ahead: 'seen from ahead',
    'starboard-bow': 'on her starboard bow',
    'starboard-beam': 'on her starboard beam',
    'starboard-quarter': 'on her starboard quarter',
    astern: 'seen from astern',
    'port-quarter': 'on her port quarter',
    'port-beam': 'on her port beam',
    'port-bow': 'on her port bow',
  },
  planAlt: "Plan view: each light's arc of visibility around the hull",
  profileAlt: 'Profile view: the vessel from abeam with her lights',
  planShapesAlt: 'Day shapes',
  towPlanAlt: "Tow plan: each vessel's arcs, and the tow length against Rule 24's threshold",
  towProfileAlt: 'Tow profile: the vessels of the tow from abeam, each with her own lights',
  towLength: (m, t) =>
    t === undefined
      ? `${Math.round(m)} m tow`
      : `${Math.round(m)} m tow, ${m > t ? 'over' : 'not over'} ${t} m`,
  towThreshold: (t) => `${t} m`,
};
