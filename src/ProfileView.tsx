// The boat from abeam (starboard side), lights glowing in place.

import type { ReactElement } from 'react';
import type { FactRecord } from 'colregs-engine';
import type { Hull } from './hulls.js';
import { PX, PZ } from './hulls.js';
import type { PlacedLight } from './placement.js';
import type { SceneLabels } from './labels.js';
import { defaultSceneLabels } from './labels.js';
import { Glow } from './svg.js';

export function ProfileView({
  hull,
  placed,
  facts,
  labels = defaultSceneLabels,
}: {
  hull: Hull;
  placed: PlacedLight[];
  facts: FactRecord;
  labels?: SceneLabels;
}): ReactElement {
  const anchored = facts['fact:position'] === 'position:anchored';
  return (
    <svg
      viewBox="0 0 440 240"
      role="img"
      aria-label={labels.profileAlt}
      className="scene-svg"
    >
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
      <hull.Profile />
      {placed.map((l) => (
        <Glow
          key={l.key}
          x={PX(l.fx) + l.py * 10}
          y={PZ(l.z)}
          color={l.color}
          flashing={l.character === 'flashing'}
          dim={l.py < -0.05}
          r={l.lightId === 'light:deck_lights' ? 9 : 5}
        />
      ))}
    </svg>
  );
}
