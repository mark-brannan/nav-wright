// The boat from abeam, lights glowing in place. Starboard side by default;
// `side="port"` mirrors it, bow to the left.

import type { ReactElement, ReactNode } from 'react';
import type { FactRecord } from 'colregs-engine';
import type { Hull } from './hulls.js';
import { PX, PZ } from './hulls.js';
import type { PlacedLight } from './placement.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { Glow } from './svg.js';
import type { HullStyle } from './hullStyles.js';
import { StyledProfile, styleForTime, useHullStylePaint } from './hullStyles.js';
import type { PlacedShape } from './shapes.js';
import { ProfileShapes } from './shapeMarks.js';

// The starboard drawing, flipped bow-to-left for the port side; no wrapper otherwise.
function Mirror({ on, children }: { on: boolean; children: ReactNode }): ReactElement {
  return on ? <g transform="translate(440 0) scale(-1 1)">{children}</g> : <>{children}</>;
}

export function ProfileView({
  hull,
  placed,
  facts,
  labels = defaultSceneLabels,
  style,
  time = 'night',
  shapes,
  side = 'starboard',
}: {
  hull: Hull;
  placed: PlacedLight[];
  facts: FactRecord;
  labels?: SceneLabels;
  /** Paint the hull in one of `hullStyles`. Default: the base drawing. */
  style?: HullStyle;
  /** `day` switches the ground to daylight, hides the lights and draws `shapes`. Default: night. */
  time?: 'day' | 'night';
  /** Day shapes from `placeShapes`, drawn on the mast when `time` is `day`. */
  shapes?: PlacedShape[];
  /** Which side is toward the viewer; lights on the far side are dimmed. */
  side?: 'starboard' | 'port';
}): ReactElement {
  const day = time === 'day';
  const port = side === 'port';
  const position = facts['fact:position'];
  const anchored = position === 'position:anchored';
  // A styled sailing hull sets its sails only underway, never at anchor,
  // moored or aground.
  const underway = position === undefined || position === 'position:underway';
  const paint = useHullStylePaint(style, 'profile', time);
  return (
    <svg
      viewBox="0 0 440 240"
      role="img"
      aria-label={labels.profileAlt}
      className="scene-svg"
      style={paint.vars}
    >
      {paint.defs}
      <Mirror on={port}>
        <rect width="440" height="240" fill="var(--sea-night)" />
        {/* horizon + waterline */}
        <line x1="0" y1={PZ(0)} x2="440" y2={PZ(0)} stroke="var(--waterline)" strokeWidth="1" />
        <rect x="0" y={PZ(0)} width="440" height={240 - PZ(0)} fill="var(--sea-below)" />
        {anchored && (
          <line
            x1={PX(hull.spec.bowX)}
            y1={PZ(0.14)}
            x2={PX(hull.spec.bowX) + 26}
            y2={238}
            stroke="var(--rig-stroke)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        )}
        {style ? (
          <StyledProfile
            hull={hull}
            style={styleForTime(style, time)}
            uid={paint.uid}
            sails={underway}
          />
        ) : (
          <hull.Profile />
        )}
        {!day &&
          placed.map((l) => (
            <Glow
              key={l.key}
              x={PX(l.fx) + (port ? -l.py : l.py) * 10}
              y={PZ(l.z)}
              color={l.color}
              flashing={l.character === 'flashing'}
              dim={port ? l.py > 0.05 : l.py < -0.05}
              r={l.lightId === 'light:deck_lights' ? 9 : 5}
            />
          ))}
        {day && shapes && <ProfileShapes shapes={shapes} />}
      </Mirror>
    </svg>
  );
}
