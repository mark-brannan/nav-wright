// The camera-elevation slider for the 3D views: the vertical partner of
// ThetaControl. 0 looks along the waterline, MAX_TILT looks straight down,
// MIN_TILT straight up from below. Drag on the canvas moves it and it moves the canvas, so the two are
// one number, and that number travels in the URL (tl=) next to θ.

import type { ReactElement } from 'react';
import type { BenchyLabels } from './benchyLabels.js';
import { MAX_TILT, MIN_TILT } from './tilt.js';

export function TiltControl({
  tilt,
  onTilt,
  labels,
}: {
  tilt: number;
  onTilt: (t: number) => void;
  labels: BenchyLabels;
}): ReactElement {
  return (
    <div className="theta-control">
      <label htmlFor="tilt">{labels.benchyTiltLabel}</label>
      <input
        id="tilt"
        type="range"
        min={MIN_TILT}
        max={MAX_TILT}
        step={1}
        value={Math.round(tilt)}
        onChange={(e) => onTilt(Number(e.target.value))}
        aria-valuetext={labels.benchyTiltValue(Math.round(tilt))}
      />
      <span className="theta-readout">{Math.round(tilt)}°</span>
    </div>
  );
}
