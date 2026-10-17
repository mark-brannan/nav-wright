// The curated base-drawing set (design doc: hybrid model — a small set of
// base vessel drawings, lights rendered dynamically on top). Coordinates
// share one space with light placement: fx fore-aft in [-1,1] (bow +1),
// z height (0 = waterline), py athwartships (starboard +).

import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';

export interface HullSpec {
  id: string;
  /** half-beam in py units */
  beam: number;
  mastX: number;
  mastTopZ: number;
  aftMastX: number;
  aftMastTopZ: number;
  sideLightX: number;
  sideLightZ: number;
  bowX: number;
  sternX: number;
  sternZ: number;
}

// profile view mapping (viewBox 0 0 440 240, waterline y=185, bow right)
export const PX = (fx: number) => 220 + fx * 185;
export const PZ = (z: number) => 185 - z * 150;

const hullStroke = 'var(--hull-stroke)';
const hullFill = 'var(--hull-fill)';
const rigStroke = 'var(--rig-stroke)';

function d(points: [number, number][]): string {
  return (
    points
      .map(([fx, z], i) => `${i === 0 ? 'M' : 'L'}${PX(fx).toFixed(1)},${PZ(z).toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

function mast(fx: number, topZ: number, deckZ = 0.12): ReactElement {
  return (
    <line
      x1={PX(fx)}
      y1={PZ(deckZ)}
      x2={PX(fx)}
      y2={PZ(topZ) - 6}
      stroke={rigStroke}
      strokeWidth={2}
    />
  );
}

export interface Hull {
  spec: HullSpec;
  Profile: () => ReactElement;
  /** top-down outline points (fx, py) for the plan view */
  plan: [number, number][];
}

const sailPlan: [number, number][] = [
  [1, 0],
  [0.7, 0.16],
  [-0.1, 0.22],
  [-0.75, 0.17],
  [-0.9, 0.1],
  [-0.9, -0.1],
  [-0.75, -0.17],
  [-0.1, -0.22],
  [0.7, -0.16],
];

const shipPlan: [number, number][] = [
  [1, 0],
  [0.75, 0.2],
  [-0.6, 0.22],
  [-0.95, 0.2],
  [-0.98, 0.08],
  [-0.98, -0.08],
  [-0.95, -0.2],
  [-0.6, -0.22],
  [0.75, -0.2],
];

const sailSmall: Hull = {
  spec: {
    id: 'sail-small',
    beam: 0.2,
    mastX: 0.12,
    mastTopZ: 0.92,
    aftMastX: -0.4,
    aftMastTopZ: 0.7,
    sideLightX: 0.35,
    sideLightZ: 0.16,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.16,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.95, 0.2],
          [0.98, 0.12],
          [0.85, 0.02],
          [-0.8, 0.02],
          [-0.9, 0.14],
          [-0.88, 0.2],
          [0.4, 0.24],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* cabin trunk */}
      <path
        d={d([
          [0.35, 0.2],
          [0.3, 0.3],
          [-0.45, 0.3],
          [-0.55, 0.2],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.12, 0.92, 0.3)}
      {/* boom + backstay + forestay */}
      <line
        x1={PX(0.12)}
        y1={PZ(0.4)}
        x2={PX(-0.6)}
        y2={PZ(0.36)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      <line
        x1={PX(0.12)}
        y1={PZ(0.92) - 6}
        x2={PX(0.94)}
        y2={PZ(0.18)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      <line
        x1={PX(0.12)}
        y1={PZ(0.92) - 6}
        x2={PX(-0.87)}
        y2={PZ(0.18)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
    </g>
  ),
};

const sailLarge: Hull = {
  ...sailSmall,
  spec: { ...sailSmall.spec, id: 'sail-large', mastTopZ: 1.05, beam: 0.22 },
};

const openBoat: Hull = {
  spec: {
    id: 'open',
    beam: 0.22,
    mastX: 0.0,
    mastTopZ: 0.5,
    aftMastX: -0.3,
    aftMastTopZ: 0.4,
    sideLightX: 0.3,
    sideLightZ: 0.14,
    bowX: 0.85,
    sternX: -0.8,
    sternZ: 0.14,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.85, 0.2],
          [0.9, 0.1],
          [0.75, 0.03],
          [-0.7, 0.03],
          [-0.8, 0.12],
          [-0.8, 0.18],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* thwarts */}
      <line
        x1={PX(0.25)}
        y1={PZ(0.16)}
        x2={PX(0.25)}
        y2={PZ(0.08)}
        stroke={rigStroke}
        strokeWidth={1}
      />
      <line
        x1={PX(-0.35)}
        y1={PZ(0.16)}
        x2={PX(-0.35)}
        y2={PZ(0.08)}
        stroke={rigStroke}
        strokeWidth={1}
      />
    </g>
  ),
};

const powerSmall: Hull = {
  spec: {
    id: 'power-small',
    beam: 0.22,
    mastX: 0.05,
    mastTopZ: 0.6,
    aftMastX: -0.45,
    aftMastTopZ: 0.5,
    sideLightX: 0.45,
    sideLightZ: 0.2,
    bowX: 0.9,
    sternX: -0.85,
    sternZ: 0.18,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.92, 0.28],
          [0.95, 0.16],
          [0.8, 0.04],
          [-0.75, 0.04],
          [-0.85, 0.14],
          [-0.85, 0.24],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* windscreen + hardtop */}
      <path
        d={d([
          [0.4, 0.26],
          [0.25, 0.44],
          [-0.35, 0.44],
          [-0.45, 0.24],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.05, 0.6, 0.44)}
    </g>
  ),
};

const powerLarge: Hull = {
  spec: {
    id: 'power-large',
    beam: 0.22,
    mastX: 0.2,
    mastTopZ: 0.78,
    aftMastX: -0.5,
    aftMastTopZ: 0.95,
    sideLightX: 0.3,
    sideLightZ: 0.32,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.24,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.94, 0.34],
          [0.97, 0.2],
          [0.85, 0.05],
          [-0.85, 0.05],
          [-0.9, 0.2],
          [-0.9, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      <path
        d={d([
          [0.45, 0.32],
          [0.4, 0.5],
          [0.05, 0.5],
          [-0.05, 0.62],
          [-0.6, 0.62],
          [-0.68, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.2, 0.78, 0.5)}
      {mast(-0.5, 0.95, 0.62)}
    </g>
  ),
};

const containerShip: Hull = {
  spec: {
    id: 'container-ship',
    beam: 0.24,
    mastX: 0.82,
    mastTopZ: 0.85,
    aftMastX: -0.35,
    aftMastTopZ: 1.05,
    sideLightX: -0.3,
    sideLightZ: 0.55,
    bowX: 0.95,
    sternX: -0.92,
    sternZ: 0.3,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.97, 0.42],
          [1.0, 0.3],
          [0.9, 0.08],
          [-0.9, 0.08],
          [-0.95, 0.26],
          [-0.93, 0.4],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* container stacks: two tiers forward of the house, bay lines between */}
      <path
        d={d([
          [0.7, 0.42],
          [0.7, 0.66],
          [-0.3, 0.66],
          [-0.3, 0.42],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={0.75}
      />
      <line
        x1={PX(0.7)}
        y1={PZ(0.54)}
        x2={PX(-0.3)}
        y2={PZ(0.54)}
        stroke={hullStroke}
        strokeWidth={0.5}
      />
      {[0.5, 0.3, 0.1, -0.1].map((fx) => (
        <line
          key={fx}
          x1={PX(fx)}
          y1={PZ(0.42)}
          x2={PX(fx)}
          y2={PZ(0.66)}
          stroke={hullStroke}
          strokeWidth={0.5}
        />
      ))}
      {/* aft superstructure */}
      <path
        d={d([
          [-0.35, 0.4],
          [-0.35, 0.72],
          [-0.7, 0.72],
          [-0.7, 0.4],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.82, 0.85, 0.42)}
      {mast(-0.35, 1.05, 0.72)}
      {/* funnel */}
      <path
        d={d([
          [-0.55, 0.72],
          [-0.52, 0.86],
          [-0.62, 0.86],
          [-0.65, 0.72],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
    </g>
  ),
};

const trawler: Hull = {
  spec: {
    id: 'trawler',
    beam: 0.22,
    mastX: 0.15,
    mastTopZ: 0.72,
    aftMastX: -0.55,
    aftMastTopZ: 0.9,
    sideLightX: 0.2,
    sideLightZ: 0.35,
    bowX: 0.92,
    sternX: -0.86,
    sternZ: 0.2,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.93, 0.36],
          [0.96, 0.22],
          [0.82, 0.05],
          [-0.8, 0.05],
          [-0.86, 0.16],
          [-0.86, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* wheelhouse forward */}
      <path
        d={d([
          [0.55, 0.34],
          [0.5, 0.56],
          [0.15, 0.56],
          [0.1, 0.32],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.15, 0.72, 0.56)}
      {/* aft gantry */}
      <path
        d={`M${PX(-0.45)},${PZ(0.22)} L${PX(-0.55)},${PZ(0.9)} L${PX(-0.65)},${PZ(0.22)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      {/* trawl warp */}
      <line
        x1={PX(-0.55)}
        y1={PZ(0.88)}
        x2={PX(-0.95)}
        y2={PZ(0.02)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
    </g>
  ),
};

const tug: Hull = {
  spec: {
    id: 'tug',
    beam: 0.24,
    mastX: 0.1,
    mastTopZ: 0.6,
    aftMastX: -0.5,
    aftMastTopZ: 0.95,
    sideLightX: 0.25,
    sideLightZ: 0.38,
    bowX: 0.88,
    sternX: -0.85,
    sternZ: 0.2,
  },
  plan: [
    [1, 0],
    [0.6, 0.2],
    [-0.6, 0.22],
    [-0.85, 0.16],
    [-0.9, 0],
    [-0.85, -0.16],
    [-0.6, -0.22],
    [0.6, -0.2],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.9, 0.4],
          [0.94, 0.24],
          [0.8, 0.06],
          [-0.8, 0.06],
          [-0.86, 0.18],
          [-0.86, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* tall wheelhouse */}
      <path
        d={d([
          [0.4, 0.38],
          [0.35, 0.68],
          [-0.05, 0.68],
          [-0.12, 0.36],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.1, 0.6, 0.68)}
      {/* towing bitts + fender bow */}
      <line
        x1={PX(-0.4)}
        y1={PZ(0.26)}
        x2={PX(-0.4)}
        y2={PZ(0.36)}
        stroke={rigStroke}
        strokeWidth={2.5}
      />
      <path
        d={`M${PX(0.9)},${PZ(0.4)} q6,-4 4,-16`}
        fill="none"
        stroke={hullStroke}
        strokeWidth={2.5}
      />
    </g>
  ),
};

const barge: Hull = {
  spec: {
    id: 'barge',
    beam: 0.24,
    mastX: 0.0,
    mastTopZ: 0.45,
    aftMastX: -0.5,
    aftMastTopZ: 0.4,
    sideLightX: 0.75,
    sideLightZ: 0.18,
    bowX: 0.9,
    sternX: -0.88,
    sternZ: 0.16,
  },
  plan: [
    [1, 0.12],
    [1, -0.12],
    [0.9, -0.2],
    [-0.9, -0.2],
    [-1, -0.12],
    [-1, 0.12],
    [-0.9, 0.2],
    [0.9, 0.2],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.92, 0.2],
          [0.95, 0.1],
          [0.9, 0.04],
          [-0.9, 0.04],
          [-0.94, 0.1],
          [-0.92, 0.2],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* cargo mound */}
      <path
        d={d([
          [0.7, 0.2],
          [0.4, 0.3],
          [-0.5, 0.3],
          [-0.75, 0.2],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={0.75}
      />
    </g>
  ),
};

/** A push tug: a square bow faced with two push knees that bear on the
 *  barge's stern, and a wheelhouse raised on a pillar so the master sees
 *  over the tow ahead. Pushing ahead she carries 24(c)'s two masthead
 *  lights, or, rigidly joined into a composite unit, 24(b)'s power-driven
 *  display for the whole unit; both stand on the wheelhouse mast. */
const pusher: Hull = {
  spec: {
    id: 'pusher',
    beam: 0.26,
    mastX: 0.15,
    mastTopZ: 0.95,
    aftMastX: -0.45,
    aftMastTopZ: 1.08,
    sideLightX: 0.3,
    sideLightZ: 0.42,
    bowX: 0.92,
    sternX: -0.86,
    sternZ: 0.2,
  },
  plan: [
    [1, 0.2],
    [1, -0.2],
    [0.95, -0.26],
    [-0.8, -0.26],
    [-0.92, -0.18],
    [-0.92, 0.18],
    [-0.8, 0.26],
    [0.95, 0.26],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.97, 0.3],
          [0.97, 0.08],
          [0.9, 0.04],
          [-0.8, 0.04],
          [-0.88, 0.16],
          [-0.88, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* push knees, standing proud of the bow */}
      <path
        d={d([
          [1.0, 0.46],
          [1.0, 0.06],
          [0.95, 0.06],
          [0.95, 0.46],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* lower house, pillar and raised wheelhouse */}
      <path
        d={d([
          [0.42, 0.3],
          [0.42, 0.46],
          [-0.22, 0.46],
          [-0.22, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [0.26, 0.46],
          [0.26, 0.64],
          [0.04, 0.64],
          [0.04, 0.46],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [0.36, 0.64],
          [0.4, 0.8],
          [-0.06, 0.8],
          [-0.1, 0.64],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.15, 0.95, 0.8)}
      {mast(-0.45, 1.08, 0.3)}
    </g>
  ),
};

/** An inconspicuous, partly submerged tow (Rule 24(g)): a dracone or a
 *  raft of logs, barely awash, most of her body under the waterline. The
 *  only light she is built for is 22(d)'s all-round white on a stub post;
 *  her submerged body is drawn dashed in the profile alone. */
const partlySubmerged: Hull = {
  spec: {
    id: 'partly-submerged',
    beam: 0.16,
    mastX: 0.0,
    mastTopZ: 0.16,
    aftMastX: -0.6,
    aftMastTopZ: 0.14,
    sideLightX: 0.5,
    sideLightZ: 0.06,
    bowX: 0.9,
    sternX: -0.88,
    sternZ: 0.08,
  },
  plan: [
    [1, 0],
    [0.8, 0.12],
    [0.3, 0.16],
    [-0.4, 0.16],
    [-0.85, 0.12],
    [-0.95, 0],
    [-0.85, -0.12],
    [-0.4, -0.16],
    [0.3, -0.16],
    [0.8, -0.12],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.92, 0],
          [0.7, 0.07],
          [-0.6, 0.07],
          [-0.9, 0],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* the body under the water */}
      <path
        d={d([
          [0.92, 0],
          [0.75, -0.1],
          [-0.75, -0.1],
          [-0.9, 0],
        ])}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      {mast(0.0, 0.16, 0.07)}
    </g>
  ),
};

// ---- plan outlines shared by the larger roster --------------------------

/** fine-lined fast hull: pilot boat, warship */
const finePlan: [number, number][] = [
  [1, 0],
  [0.6, 0.13],
  [-0.2, 0.18],
  [-0.8, 0.15],
  [-0.92, 0.08],
  [-0.92, -0.08],
  [-0.8, -0.15],
  [-0.2, -0.18],
  [0.6, -0.13],
];

/** full-bodied cargo hull: tanker, bulker */
const bluffPlan: [number, number][] = [
  [1, 0],
  [0.82, 0.2],
  [0.6, 0.25],
  [-0.7, 0.25],
  [-0.92, 0.18],
  [-0.98, 0.07],
  [-0.98, -0.07],
  [-0.92, -0.18],
  [-0.7, -0.25],
  [0.6, -0.25],
  [0.82, -0.2],
];

/** pontoon hull with a bow: dredger */
const pontoonPlan: [number, number][] = [
  [1, 0],
  [0.92, 0.16],
  [0.75, 0.24],
  [-0.85, 0.24],
  [-0.96, 0.16],
  [-0.96, -0.16],
  [-0.85, -0.24],
  [0.75, -0.24],
  [0.92, -0.16],
];

const pilotBoat: Hull = {
  spec: {
    id: 'pilot-boat',
    beam: 0.2,
    mastX: 0.0,
    mastTopZ: 0.72,
    aftMastX: -0.5,
    aftMastTopZ: 0.55,
    sideLightX: 0.25,
    sideLightZ: 0.3,
    bowX: 0.9,
    sternX: -0.84,
    sternZ: 0.22,
  },
  plan: finePlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.9, 0.32],
          [0.95, 0.18],
          [0.82, 0.04],
          [-0.78, 0.04],
          [-0.86, 0.14],
          [-0.86, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* raked wheelhouse */}
      <path
        d={d([
          [0.3, 0.3],
          [0.2, 0.5],
          [-0.3, 0.5],
          [-0.38, 0.28],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.0, 0.72, 0.5)}
      {/* fender strake */}
      <line
        x1={PX(0.86)}
        y1={PZ(0.2)}
        x2={PX(-0.84)}
        y2={PZ(0.18)}
        stroke={rigStroke}
        strokeWidth={2}
      />
    </g>
  ),
};

const ferry: Hull = {
  spec: {
    id: 'ferry',
    beam: 0.24,
    mastX: 0.5,
    mastTopZ: 0.9,
    aftMastX: -0.65,
    aftMastTopZ: 1.0,
    sideLightX: 0.4,
    sideLightZ: 0.6,
    bowX: 0.95,
    sternX: -0.92,
    sternZ: 0.3,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.95, 0.36],
          [0.98, 0.22],
          [0.88, 0.06],
          [-0.9, 0.06],
          [-0.95, 0.2],
          [-0.94, 0.34],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* full-length passenger deck */}
      <path
        d={d([
          [0.7, 0.34],
          [0.65, 0.56],
          [-0.75, 0.56],
          [-0.8, 0.34],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {[0.5, 0.3, 0.1, -0.1, -0.3, -0.5].map((fx) => (
        <line
          key={fx}
          x1={PX(fx)}
          y1={PZ(0.4)}
          x2={PX(fx + 0.1)}
          y2={PZ(0.4)}
          stroke={hullStroke}
          strokeWidth={0.75}
        />
      ))}
      {/* bridge forward, funnel aft */}
      <path
        d={d([
          [0.6, 0.56],
          [0.55, 0.7],
          [0.3, 0.7],
          [0.25, 0.56],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [-0.5, 0.56],
          [-0.48, 0.7],
          [-0.58, 0.7],
          [-0.6, 0.56],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.5, 0.9, 0.7)}
      {mast(-0.65, 1.0, 0.56)}
    </g>
  ),
};

const tanker: Hull = {
  spec: {
    id: 'tanker',
    beam: 0.26,
    mastX: 0.75,
    mastTopZ: 0.7,
    aftMastX: -0.5,
    aftMastTopZ: 1.0,
    sideLightX: -0.55,
    sideLightZ: 0.62,
    bowX: 0.97,
    sternX: -0.92,
    sternZ: 0.3,
  },
  plan: bluffPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.97, 0.3],
          [1.0, 0.22],
          [0.9, 0.08],
          [-0.9, 0.08],
          [-0.96, 0.22],
          [-0.94, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* raised forecastle */}
      <path
        d={d([
          [0.97, 0.3],
          [0.97, 0.38],
          [0.7, 0.38],
          [0.7, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* pipe deck and midships manifold */}
      <line
        x1={PX(0.68)}
        y1={PZ(0.34)}
        x2={PX(-0.44)}
        y2={PZ(0.34)}
        stroke={rigStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [0.12, 0.3],
          [0.12, 0.46],
          [-0.06, 0.46],
          [-0.06, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={0.75}
      />
      {/* aft accommodation block + funnel */}
      <path
        d={d([
          [-0.45, 0.3],
          [-0.45, 0.72],
          [-0.8, 0.72],
          [-0.8, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [-0.62, 0.72],
          [-0.6, 0.86],
          [-0.72, 0.86],
          [-0.74, 0.72],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.75, 0.7, 0.38)}
      {mast(-0.5, 1.0, 0.72)}
    </g>
  ),
};

const bulker: Hull = {
  spec: {
    id: 'bulker',
    beam: 0.26,
    mastX: 0.78,
    mastTopZ: 0.68,
    aftMastX: -0.64,
    aftMastTopZ: 1.0,
    sideLightX: -0.6,
    sideLightZ: 0.64,
    bowX: 0.97,
    sternX: -0.92,
    sternZ: 0.3,
  },
  plan: bluffPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.97, 0.3],
          [1.0, 0.22],
          [0.9, 0.08],
          [-0.9, 0.08],
          [-0.96, 0.22],
          [-0.94, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      <path
        d={d([
          [0.97, 0.3],
          [0.97, 0.38],
          [0.72, 0.38],
          [0.72, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* five hatch coamings */}
      {[0.5, 0.26, 0.02, -0.22, -0.46].map((fx) => (
        <path
          key={fx}
          d={d([
            [fx + 0.1, 0.3],
            [fx + 0.1, 0.4],
            [fx - 0.1, 0.4],
            [fx - 0.1, 0.3],
          ])}
          fill={hullFill}
          stroke={hullStroke}
          strokeWidth={0.75}
        />
      ))}
      {/* deck cranes between hatches */}
      {[0.38, -0.1].map((fx) => (
        <path
          key={fx}
          d={`M${PX(fx)},${PZ(0.3)} L${PX(fx)},${PZ(0.6)} L${PX(fx - 0.16)},${PZ(0.5)}`}
          fill="none"
          stroke={rigStroke}
          strokeWidth={1.5}
        />
      ))}
      {/* aft house + funnel */}
      <path
        d={d([
          [-0.6, 0.3],
          [-0.6, 0.76],
          [-0.84, 0.76],
          [-0.84, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [-0.7, 0.76],
          [-0.68, 0.88],
          [-0.78, 0.88],
          [-0.8, 0.76],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.78, 0.68, 0.38)}
      {mast(-0.64, 1.0, 0.76)}
    </g>
  ),
};

const cruiseShip: Hull = {
  spec: {
    id: 'cruise-ship',
    beam: 0.24,
    mastX: 0.5,
    mastTopZ: 1.0,
    aftMastX: -0.55,
    aftMastTopZ: 1.1,
    sideLightX: 0.55,
    sideLightZ: 0.7,
    bowX: 0.96,
    sternX: -0.92,
    sternZ: 0.36,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.96, 0.4],
          [1.0, 0.26],
          [0.88, 0.08],
          [-0.9, 0.08],
          [-0.95, 0.24],
          [-0.93, 0.38],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* three stepped deck tiers */}
      <path
        d={d([
          [0.75, 0.38],
          [0.72, 0.58],
          [-0.85, 0.58],
          [-0.88, 0.38],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [0.62, 0.58],
          [0.58, 0.76],
          [-0.76, 0.76],
          [-0.8, 0.58],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [0.5, 0.76],
          [0.46, 0.9],
          [-0.62, 0.9],
          [-0.66, 0.76],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {[0.48, 0.66].map((z) => (
        <line
          key={z}
          x1={PX(0.66)}
          y1={PZ(z)}
          x2={PX(-0.8)}
          y2={PZ(z)}
          stroke={hullStroke}
          strokeWidth={0.5}
        />
      ))}
      {/* raked funnel */}
      <path
        d={d([
          [-0.32, 0.9],
          [-0.26, 1.02],
          [-0.42, 1.02],
          [-0.5, 0.9],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.5, 1.0, 0.76)}
      {mast(-0.55, 1.1, 0.9)}
    </g>
  ),
};

const warship: Hull = {
  spec: {
    id: 'warship',
    beam: 0.2,
    mastX: -0.02,
    mastTopZ: 0.85,
    aftMastX: -0.5,
    aftMastTopZ: 1.0,
    sideLightX: 0.1,
    sideLightZ: 0.62,
    bowX: 0.95,
    sternX: -0.9,
    sternZ: 0.28,
  },
  plan: finePlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.95, 0.4],
          [1.0, 0.3],
          [0.9, 0.06],
          [-0.88, 0.06],
          [-0.93, 0.2],
          [-0.93, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* forward gun mount */}
      <path
        d={d([
          [0.62, 0.38],
          [0.6, 0.48],
          [0.48, 0.48],
          [0.46, 0.37],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <line
        x1={PX(0.6)}
        y1={PZ(0.45)}
        x2={PX(0.82)}
        y2={PZ(0.5)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      {/* bridge block */}
      <path
        d={d([
          [0.35, 0.36],
          [0.3, 0.68],
          [-0.08, 0.68],
          [-0.12, 0.35],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* pyramid mast */}
      <path
        d={`M${PX(0.08)},${PZ(0.68)} L${PX(-0.02)},${PZ(0.85) - 6} L${PX(-0.12)},${PZ(0.68)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      {/* funnel + hangar aft */}
      <path
        d={d([
          [-0.2, 0.34],
          [-0.2, 0.56],
          [-0.3, 0.56],
          [-0.3, 0.34],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [-0.36, 0.33],
          [-0.36, 0.52],
          [-0.7, 0.52],
          [-0.7, 0.32],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(-0.5, 1.0, 0.52)}
    </g>
  ),
};

const squareRigger: Hull = {
  spec: {
    id: 'square-rigger',
    beam: 0.2,
    mastX: 0.5,
    mastTopZ: 1.0,
    aftMastX: -0.05,
    aftMastTopZ: 1.1,
    sideLightX: 0.3,
    sideLightZ: 0.28,
    bowX: 0.9,
    sternX: -0.86,
    sternZ: 0.26,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.9, 0.3],
          [0.95, 0.2],
          [0.82, 0.03],
          [-0.82, 0.03],
          [-0.9, 0.16],
          [-0.88, 0.3],
          [-0.4, 0.26],
          [0.3, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* bowsprit */}
      <line
        x1={PX(0.86)}
        y1={PZ(0.3)}
        x2={PX(1.06)}
        y2={PZ(0.42)}
        stroke={rigStroke}
        strokeWidth={2}
      />
      {/* fore, main, mizzen with braced yards */}
      {mast(0.5, 1.0, 0.26)}
      {mast(-0.05, 1.1, 0.26)}
      {mast(-0.55, 0.9, 0.28)}
      {(
        [
          [0.5, 1.0],
          [-0.05, 1.1],
          [-0.55, 0.9],
        ] as [number, number][]
      ).map(([fx, top]) =>
        [0.48, 0.66, 0.82].map((z) =>
          z < top ? (
            <line
              key={`${fx}:${z}`}
              x1={PX(fx) - 22 * (1 - (z - 0.4) / top)}
              y1={PZ(z)}
              x2={PX(fx) + 22 * (1 - (z - 0.4) / top)}
              y2={PZ(z)}
              stroke={rigStroke}
              strokeWidth={1.25}
            />
          ) : null,
        ),
      )}
      {/* stays */}
      <line
        x1={PX(0.5)}
        y1={PZ(1.0) - 6}
        x2={PX(1.04)}
        y2={PZ(0.4)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      <line
        x1={PX(-0.05)}
        y1={PZ(1.1) - 6}
        x2={PX(0.5)}
        y2={PZ(0.98)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      <line
        x1={PX(-0.55)}
        y1={PZ(0.9) - 6}
        x2={PX(-0.05)}
        y2={PZ(1.06)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
    </g>
  ),
};

const seiner: Hull = {
  spec: {
    id: 'seiner',
    beam: 0.22,
    mastX: 0.15,
    mastTopZ: 0.9,
    aftMastX: -0.45,
    aftMastTopZ: 0.78,
    sideLightX: 0.25,
    sideLightZ: 0.34,
    bowX: 0.92,
    sternX: -0.86,
    sternZ: 0.22,
  },
  plan: [
    [1, 0],
    [0.6, 0.18],
    [-0.3, 0.23],
    [-0.82, 0.22],
    [-0.9, 0.12],
    [-0.9, -0.12],
    [-0.82, -0.22],
    [-0.3, -0.23],
    [0.6, -0.18],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.92, 0.36],
          [0.96, 0.22],
          [0.82, 0.05],
          [-0.82, 0.05],
          [-0.88, 0.16],
          [-0.88, 0.24],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* wheelhouse forward */}
      <path
        d={d([
          [0.6, 0.34],
          [0.55, 0.56],
          [0.2, 0.56],
          [0.15, 0.32],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.15, 0.9, 0.56)}
      {/* boom */}
      <line
        x1={PX(0.15)}
        y1={PZ(0.66)}
        x2={PX(-0.4)}
        y2={PZ(0.5)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      {/* power block on its crane, net stacked aft */}
      <path
        d={`M${PX(-0.2)},${PZ(0.24)} L${PX(-0.45)},${PZ(0.78)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      <circle
        cx={PX(-0.45)}
        cy={PZ(0.78)}
        r={4}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      <path
        d={d([
          [-0.5, 0.24],
          [-0.55, 0.36],
          [-0.8, 0.36],
          [-0.85, 0.24],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={0.75}
      />
    </g>
  ),
};

const dredger: Hull = {
  spec: {
    id: 'dredger',
    beam: 0.26,
    mastX: 0.7,
    mastTopZ: 0.82,
    aftMastX: -0.45,
    aftMastTopZ: 0.95,
    sideLightX: -0.2,
    sideLightZ: 0.5,
    bowX: 0.95,
    sternX: -0.92,
    sternZ: 0.24,
  },
  plan: pontoonPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.95, 0.26],
          [0.97, 0.14],
          [0.92, 0.05],
          [-0.92, 0.05],
          [-0.97, 0.14],
          [-0.95, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* ladder gantry over the bow, ladder down into the water */}
      <path
        d={`M${PX(0.6)},${PZ(0.26)} L${PX(0.7)},${PZ(0.82) - 6} L${PX(0.8)},${PZ(0.26)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      <line
        x1={PX(0.72)}
        y1={PZ(0.6)}
        x2={PX(1.04)}
        y2={PZ(-0.02)}
        stroke={rigStroke}
        strokeWidth={2.5}
      />
      <line
        x1={PX(0.7)}
        y1={PZ(0.78)}
        x2={PX(0.98)}
        y2={PZ(0.1)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      {/* aft house + mast, spud pole at the stern */}
      <path
        d={d([
          [-0.3, 0.26],
          [-0.3, 0.56],
          [-0.75, 0.56],
          [-0.75, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(-0.45, 0.95, 0.56)}
      <line
        x1={PX(-0.88)}
        y1={PZ(-0.02)}
        x2={PX(-0.88)}
        y2={PZ(0.72)}
        stroke={rigStroke}
        strokeWidth={3}
      />
    </g>
  ),
};

/** A mine-countermeasures vessel: a beamy wooden or GRP hull, bridge
 *  forward of midships, and the sweep deck aft with a gear boom over the
 *  stern and the sweep wire streamed astern. Only the boom and the wire
 *  down to the water are rig (they loft into the mesh); the wire and float
 *  astern of the hull are drawn in the profile alone. Beam, deck line and
 *  mast tops are set so that at 50 m, where Rule 23(a)(ii) first asks for
 *  the after masthead light, Annex I puts both masthead lights on the drawn
 *  mast heads and inside the profile frame; the yard sits where 27(f)'s
 *  yard-end lights hang, two stack steps under the foremast head. */
const mineClearance: Hull = {
  spec: {
    id: 'mine-clearance',
    beam: 0.17,
    mastX: 0.18,
    mastTopZ: 0.92,
    aftMastX: -0.42,
    aftMastTopZ: 1.14,
    sideLightX: 0.3,
    sideLightZ: 0.5,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.26,
  },
  plan: [
    [1, 0],
    [0.7, 0.128],
    [0.1, 0.17],
    [-0.7, 0.156],
    [-0.9, 0.113],
    [-0.9, -0.113],
    [-0.7, -0.156],
    [0.1, -0.17],
    [0.7, -0.128],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.92, 0.42],
          [0.97, 0.32],
          [0.86, 0.05],
          [-0.84, 0.05],
          [-0.9, 0.18],
          [-0.9, 0.28],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* bridge and superstructure */}
      <path
        d={d([
          [0.5, 0.38],
          [0.44, 0.6],
          [0.0, 0.6],
          [-0.05, 0.34],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.18, 0.92, 0.6)}
      {/* yardarm for the mine-clearance lights */}
      <line
        x1={PX(0.1)}
        y1={PZ(0.66)}
        x2={PX(0.26)}
        y2={PZ(0.66)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      {/* funnel house */}
      <path
        d={d([
          [-0.15, 0.33],
          [-0.15, 0.5],
          [-0.36, 0.5],
          [-0.36, 0.32],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(-0.42, 1.14, 0.31)}
      {/* sweep davit, gear boom over the stern, sweep wire to the water */}
      <path
        d={`M${PX(-0.62)},${PZ(0.3)} L${PX(-0.72)},${PZ(0.66)} L${PX(-0.8)},${PZ(0.29)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      <line
        x1={PX(-0.72)}
        y1={PZ(0.66)}
        x2={PX(-0.97)}
        y2={PZ(0.46)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      <line
        x1={PX(-0.97)}
        y1={PZ(0.46)}
        x2={PX(-0.98)}
        y2={PZ(0.0)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      {/* streamed sweep and its float, astern */}
      <path
        d={`M${PX(-0.98)},${PZ(0.0)} Q${PX(-1.03)},${PZ(-0.08)} ${PX(-1.08)},${PZ(-0.02)}`}
        fill="none"
        stroke={hullStroke}
        strokeWidth={0.75}
        strokeDasharray="3 2"
      />
      <path
        d={d([
          [-1.06, 0.0],
          [-1.07, 0.04],
          [-1.11, 0.04],
          [-1.12, 0.0],
        ])}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
      />
    </g>
  ),
};

/** A fishing vessel with its gear out: a derrick boom swung up from the
 *  mast, the stern gantry, and the trawl warp running down astern to a net
 *  under the water. The warp to the waterline is rig (it lofts into the
 *  mesh); the warp under water and the net are drawn in the profile alone. */
const fishingGear: Hull = {
  spec: {
    id: 'fishing-gear',
    beam: 0.22,
    mastX: 0.15,
    mastTopZ: 0.74,
    aftMastX: -0.55,
    aftMastTopZ: 0.9,
    sideLightX: 0.2,
    sideLightZ: 0.36,
    bowX: 0.92,
    sternX: -0.86,
    sternZ: 0.2,
  },
  plan: sailPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.93, 0.38],
          [0.97, 0.24],
          [0.82, 0.04],
          [-0.8, 0.04],
          [-0.86, 0.16],
          [-0.86, 0.26],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* wheelhouse forward */}
      <path
        d={d([
          [0.55, 0.35],
          [0.5, 0.58],
          [0.15, 0.58],
          [0.1, 0.33],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.15, 0.74, 0.58)}
      {/* derrick boom, topped up from the mast foot */}
      <line
        x1={PX(0.05)}
        y1={PZ(0.32)}
        x2={PX(-0.3)}
        y2={PZ(0.82)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      <line
        x1={PX(0.15)}
        y1={PZ(0.7)}
        x2={PX(-0.3)}
        y2={PZ(0.82)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      {/* stern gantry */}
      <path
        d={`M${PX(-0.45)},${PZ(0.24)} L${PX(-0.55)},${PZ(0.9)} L${PX(-0.65)},${PZ(0.24)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      {/* trawl warp to the water */}
      <line
        x1={PX(-0.55)}
        y1={PZ(0.88)}
        x2={PX(-0.97)}
        y2={PZ(0.0)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      {/* the warp under water, and the net */}
      <line
        x1={PX(-0.97)}
        y1={PZ(0.0)}
        x2={PX(-1.06)}
        y2={PZ(-0.14)}
        stroke={hullStroke}
        strokeWidth={0.75}
        strokeDasharray="3 2"
      />
      <path
        d={d([
          [-1.06, -0.09],
          [-1.06, -0.2],
          [-1.17, -0.16],
          [-1.17, -0.13],
        ])}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
        strokeDasharray="2 1.5"
      />
    </g>
  ),
};

/** A small coaster aground: her forefoot up on a shoal, so she sits
 *  trimmed by the stern with her keel clear of the waterline forward. The shoal is drawn in the
 *  profile alone; the hull lofts with the trim. */
const aground: Hull = {
  spec: {
    id: 'aground',
    beam: 0.22,
    mastX: 0.5,
    mastTopZ: 0.88,
    aftMastX: -0.55,
    aftMastTopZ: 1.02,
    sideLightX: -0.4,
    sideLightZ: 0.6,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.32,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      {/* the shoal under the forefoot */}
      <path
        d={`M${PX(0.15)},${PZ(-0.22)} Q${PX(0.7)},${PZ(0.47)} ${PX(1.2)},${PZ(-0.22)}`}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
        strokeDasharray="4 2"
      />
      <path
        d={d([
          [0.95, 0.52],
          [1.0, 0.42],
          [0.86, 0.14],
          [-0.86, 0.02],
          [-0.92, 0.18],
          [-0.92, 0.32],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* forecastle */}
      <path
        d={d([
          [0.92, 0.5],
          [0.92, 0.6],
          [0.7, 0.6],
          [0.7, 0.48],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.5, 0.88, 0.46)}
      {/* bridge aft */}
      <path
        d={d([
          [-0.32, 0.37],
          [-0.36, 0.68],
          [-0.76, 0.68],
          [-0.78, 0.33],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(-0.55, 1.02, 0.68)}
    </g>
  ),
};

/** A dive-support vessel: wheelhouse forward on a low working deck, the
 *  dive station amidships with a decompression chamber, and an A-frame
 *  over the stern with its fall down to the water. The foremast stands on
 *  the wheelhouse, tall enough that 27(e)(i)'s red-white-red stack hangs
 *  under the masthead light and clear of the roof. The fall below the
 *  waterline and the diver's down-line are drawn in the profile alone. */
const diveSupport: Hull = {
  spec: {
    id: 'dive-support',
    beam: 0.22,
    mastX: 0.38,
    mastTopZ: 1.02,
    aftMastX: -0.72,
    aftMastTopZ: 0.78,
    sideLightX: 0.42,
    sideLightZ: 0.4,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.2,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.94, 0.4],
          [0.98, 0.28],
          [0.84, 0.03],
          [-0.84, 0.03],
          [-0.9, 0.14],
          [-0.9, 0.22],
          [0.2, 0.24],
          [0.3, 0.36],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* wheelhouse forward */}
      <path
        d={d([
          [0.66, 0.36],
          [0.6, 0.56],
          [0.22, 0.56],
          [0.2, 0.3],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.38, 1.02, 0.56)}
      {/* decompression chamber on the dive deck */}
      <path
        d={d([
          [-0.05, 0.24],
          [-0.05, 0.36],
          [-0.32, 0.36],
          [-0.32, 0.23],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* A-frame over the stern, its fall to the water */}
      <path
        d={`M${PX(-0.58)},${PZ(0.22)} L${PX(-0.72)},${PZ(0.78) - 6} L${PX(-0.84)},${PZ(0.21)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      <line
        x1={PX(-0.72)}
        y1={PZ(0.74)}
        x2={PX(-0.96)}
        y2={PZ(0.64)}
        stroke={rigStroke}
        strokeWidth={1.5}
      />
      <line
        x1={PX(-0.96)}
        y1={PZ(0.64)}
        x2={PX(-0.96)}
        y2={PZ(0.0)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      {/* the down-line under water, and the diving stage on it */}
      <line
        x1={PX(-0.96)}
        y1={PZ(0.0)}
        x2={PX(-0.96)}
        y2={PZ(-0.2)}
        stroke={hullStroke}
        strokeWidth={0.75}
        strokeDasharray="3 2"
      />
      <path
        d={d([
          [-0.92, -0.2],
          [-0.92, -0.26],
          [-1.0, -0.26],
          [-1.0, -0.2],
        ])}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
      />
    </g>
  ),
};

/** A wing-in-ground craft on the water: a low, flat hull that is half
 *  float, half fuselage, a canopy forward, short stub wings and a T-tail.
 *  The plan outline carries the wings, so the side lights sit near the wing
 *  tips; the masthead light rides a short mast on the canopy, and 23(c)'s
 *  flashing red goes under it. */
const wingInGround: Hull = {
  spec: {
    id: 'wing-in-ground',
    beam: 0.3,
    mastX: 0.3,
    mastTopZ: 0.62,
    aftMastX: -0.8,
    aftMastTopZ: 0.7,
    sideLightX: 0.1,
    sideLightZ: 0.16,
    bowX: 0.94,
    sternX: -0.88,
    sternZ: 0.16,
  },
  plan: [
    [1, 0],
    [0.8, 0.07],
    [0.3, 0.09],
    [0.12, 0.3],
    [-0.08, 0.3],
    [-0.12, 0.09],
    [-0.75, 0.06],
    [-0.82, 0.15],
    [-0.92, 0.15],
    [-0.92, -0.15],
    [-0.82, -0.15],
    [-0.75, -0.06],
    [-0.12, -0.09],
    [-0.08, -0.3],
    [0.12, -0.3],
    [0.3, -0.09],
    [0.8, -0.07],
  ],
  Profile: () => (
    <g>
      <path
        d={d([
          [0.96, 0.16],
          [0.96, 0.1],
          [0.8, 0.02],
          [-0.2, 0.02],
          [-0.88, 0.1],
          [-0.9, 0.18],
          [0.4, 0.2],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* canopy forward */}
      <path
        d={d([
          [0.62, 0.19],
          [0.5, 0.3],
          [0.18, 0.3],
          [0.1, 0.18],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.3, 0.62, 0.3)}
      {/* stub wing, seen edge on, and its float */}
      <path
        d={`M${PX(0.14)},${PZ(0.11)} L${PX(-0.1)},${PZ(0.13)}`}
        fill="none"
        stroke={hullStroke}
        strokeWidth={3}
      />
      {/* tail fin and the tailplane on top of it */}
      <path
        d={`M${PX(-0.62)},${PZ(0.16)} L${PX(-0.8)},${PZ(0.7)} L${PX(-0.9)},${PZ(0.7)} L${PX(-0.88)},${PZ(0.18)}`}
        fill="none"
        stroke={rigStroke}
        strokeWidth={2}
      />
      <line
        x1={PX(-0.72)}
        y1={PZ(0.7)}
        x2={PX(-0.96)}
        y2={PZ(0.7)}
        stroke={rigStroke}
        strokeWidth={2.5}
      />
    </g>
  ),
};

/** A vessel restricted in her ability to manoeuvre by her work, and not
 *  diving, dredging or clearing mines: a buoy tender laying a navigation
 *  buoy. Bridge forward, the long buoy deck aft with a heavy crane, its
 *  boom swung out over the quarter and the buoy in the sling. Beam, deck
 *  and mast heads are set so that at 60 m Annex I puts both masthead lights
 *  on the drawn masts and inside the profile frame, with the red-white-red
 *  stack under the forward one. */
const restrictedAbility: Hull = {
  spec: {
    id: 'restricted-ability',
    beam: 0.18,
    mastX: 0.52,
    mastTopZ: 0.94,
    aftMastX: -0.5,
    aftMastTopZ: 1.13,
    sideLightX: 0.4,
    sideLightZ: 0.5,
    bowX: 0.92,
    sternX: -0.88,
    sternZ: 0.24,
  },
  plan: shipPlan,
  Profile: () => (
    <g>
      <path
        d={d([
          [0.94, 0.46],
          [0.98, 0.34],
          [0.86, 0.04],
          [-0.86, 0.04],
          [-0.92, 0.16],
          [-0.92, 0.26],
          [0.2, 0.28],
          [0.3, 0.4],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1.5}
      />
      {/* bridge and accommodation forward */}
      <path
        d={d([
          [0.74, 0.42],
          [0.68, 0.64],
          [0.26, 0.64],
          [0.22, 0.34],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {mast(0.52, 0.94, 0.64)}
      {/* crane pedestal on the buoy deck */}
      <path
        d={d([
          [-0.02, 0.28],
          [-0.02, 0.44],
          [-0.14, 0.44],
          [-0.14, 0.28],
        ])}
        fill={hullFill}
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* crane boom out over the quarter, the fall and the buoy in the sling */}
      <line
        x1={PX(-0.08)}
        y1={PZ(0.44)}
        x2={PX(-0.72)}
        y2={PZ(0.86)}
        stroke={rigStroke}
        strokeWidth={2.5}
      />
      <line
        x1={PX(-0.72)}
        y1={PZ(0.86)}
        x2={PX(-0.72)}
        y2={PZ(0.44)}
        stroke={rigStroke}
        strokeWidth={0.75}
      />
      <path
        d={d([
          [-0.66, 0.44],
          [-0.69, 0.32],
          [-0.75, 0.32],
          [-0.78, 0.44],
        ])}
        fill="none"
        stroke={hullStroke}
        strokeWidth={1}
      />
      {/* after mast, on the stern */}
      {mast(-0.5, 1.13, 0.27)}
    </g>
  ),
};

/**
 * Pick the base drawing for a set of facts. Position first (a vessel
 * aground is drawn aground whatever she is), then activity (a trawler is a
 * trawler at any length; with gear out, the fishing hull draws it; a vessel
 * pushing draws the push tug, one towing the tug, and a tow the barge;
 * a partly submerged object of 24(g) is drawn awash ahead of all of these), then
 * propulsion, then the wing-in-ground craft (power-driven on the surface by
 * Rule 3(m), so she would otherwise fall into a length band), then length
 * bands for plain power vessels. No fact separates a cruise ship from a box
 * ship, so `cruiseShip` is never chosen here; a consumer that knows picks it
 * from `allHulls`. Bulk carriers are told apart by speed: the slow end of the
 * large-ship band is the bulker, the fast end the container ship. The
 * warship has no fact of its own either, since mine clearance took its
 * mapping; it stays in `allHulls`.
 */
export function selectHull(facts: FactRecord): Hull {
  const activity = facts['fact:activity'];
  const length =
    typeof facts['fact:length_m'] === 'number' ? (facts['fact:length_m'] as number) : 12;
  if (facts['fact:position'] === 'position:aground') return aground;
  // fact:partly_submerged is colregs' 24(g) key; the older
  // fact:inconspicuous_partly_submerged_tow is read too, since the engine's
  // own fact vocabulary may still carry only that one. Either names the
  // object, whatever else the record says, so it outranks activity.
  const rec = facts as Readonly<Record<string, unknown>>;
  if (
    rec['fact:partly_submerged'] === true ||
    rec['fact:inconspicuous_partly_submerged_tow'] === true
  )
    return partlySubmerged;
  if (activity === 'activity:trawling' || activity === 'activity:fishing') {
    const gear = facts['fact:gear_extent_m'];
    if (typeof gear === 'number' && gear > 0) return fishingGear;
    return activity === 'activity:trawling' ? trawler : seiner;
  }
  if (activity === 'activity:towing') return tug;
  if (activity === 'activity:pushing') return pusher;
  if (activity === 'activity:being_towed') return barge;
  if (activity === 'activity:pilot') return pilotBoat;
  if (activity === 'activity:cbd') return tanker;
  if (activity === 'activity:mine') return mineClearance;
  if (activity === 'activity:ram_underwater') return dredger;
  if (activity === 'activity:diving') return diveSupport;
  if (activity === 'activity:ram') return restrictedAbility;
  const propulsion = facts['fact:propulsion'];
  if (propulsion === 'propulsion:oars') return openBoat;
  if (propulsion === 'propulsion:sail') {
    if (length < 20) return sailSmall;
    return length < 40 ? sailLarge : squareRigger;
  }
  if (facts['fact:wig'] === true) return wingInGround;
  if (length < 7) return openBoat;
  if (length < 20) return powerSmall;
  if (length < 50) return powerLarge;
  if (length < 120) return ferry;
  const speed = facts['fact:max_speed_kn'];
  if (typeof speed === 'number' && speed <= 16) return bulker;
  return containerShip;
}

export const allHulls = {
  openBoat,
  powerSmall,
  powerLarge,
  sailSmall,
  sailLarge,
  squareRigger,
  trawler,
  seiner,
  tug,
  pusher,
  barge,
  partlySubmerged,
  pilotBoat,
  ferry,
  containerShip,
  tanker,
  bulker,
  cruiseShip,
  warship,
  dredger,
  mineClearance,
  fishingGear,
  aground,
  diveSupport,
  wingInGround,
  restrictedAbility,
};
