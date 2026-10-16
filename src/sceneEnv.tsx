// The environment backdrop of SceneView's plan frame: a narrow channel or a
// traffic lane, drawn from the fact's `env:` keys. Composition only; it
// carries no rule text and draws no verdict.

import type { ReactElement } from 'react';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';

/**
 * `pair:env:narrow_channel` and `pair:env:traffic_lane` (colregs ADR 0005,
 * 2026-09-04 addendum). Absent or false draws nothing.
 */
export interface SceneEnv {
  narrowChannel?: boolean;
  trafficLane?: boolean;
}

const BANK_MARGIN_PX = 20; // channel banks stand this far outside the lane
const CHEVRON_STEP_PX = 70;

/**
 * The backdrop, drawn in the frame's own pixels. `axisDeg` is the corridor's
 * direction (true deg, north-up plan) and `centre` a point on its centreline;
 * `halfWidthPx` is the half-width of the water the vessels sit in.
 */
export function SceneEnvBackdrop({
  env,
  axisDeg,
  centre,
  halfWidthPx,
  size,
  labels = defaultSceneLabels,
}: {
  env: SceneEnv;
  axisDeg: number;
  centre: { x: number; y: number };
  halfWidthPx: number;
  size: number;
  labels?: SceneLabels;
}): ReactElement | null {
  if (!env.narrowChannel && !env.trafficLane) return null;
  const len = 2 * size; // long enough to leave the frame at any rotation
  const hw = halfWidthPx;
  const chevrons: ReactElement[] = [];
  for (let y = -len / 2; y <= len / 2; y += CHEVRON_STEP_PX) {
    chevrons.push(<path key={y} d={`M${-8},${y + 8} L0,${y} L8,${y + 8}`} />);
  }
  // Axis frame: up the page is the direction of travel, +x is to starboard.
  return (
    <g data-env-backdrop transform={`translate(${centre.x} ${centre.y}) rotate(${axisDeg})`}>
      {env.narrowChannel && (
        <g
          data-env="narrow-channel"
          role="img"
          aria-label={labels.envNarrowChannel ?? defaultSceneLabels.envNarrowChannel!}
        >
          {[-1, 1].map((side) => {
            const edge = side * (hw + BANK_MARGIN_PX);
            return (
              <g key={side}>
                <rect
                  x={side < 0 ? -len : edge}
                  y={-len / 2}
                  width={len - Math.abs(edge)}
                  height={len}
                  fill="var(--bank-fill, #3d3a2a)"
                  opacity={0.9}
                />
                <line
                  x1={edge}
                  y1={-len / 2}
                  x2={edge}
                  y2={len / 2}
                  stroke="var(--bank-edge, #8a8560)"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </g>
      )}
      {env.trafficLane && (
        <g
          data-env="traffic-lane"
          role="img"
          aria-label={labels.envTrafficLane ?? defaultSceneLabels.envTrafficLane!}
        >
          <rect
            x={-hw}
            y={-len / 2}
            width={2 * hw}
            height={len}
            fill="var(--lane-fill, #1c2f55)"
            opacity={0.6}
          />
          <line
            x1={hw}
            y1={-len / 2}
            x2={hw}
            y2={len / 2}
            stroke="var(--lane-edge, #6f8fc4)"
            strokeWidth={1}
          />
          <line
            data-env-separation
            x1={-hw}
            y1={-len / 2}
            x2={-hw}
            y2={len / 2}
            stroke="var(--lane-separation, #c46fb0)"
            strokeWidth={2}
            strokeDasharray="10 5"
          />
          <g
            fill="none"
            stroke="var(--lane-arrow, #6f8fc4)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          >
            {chevrons}
          </g>
        </g>
      )}
    </g>
  );
}
