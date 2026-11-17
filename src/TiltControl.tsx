// The camera-elevation slider for the 3D views: the vertical partner of
// ThetaControl. 0 looks along the waterline, MAX_TILT looks straight down,
// MIN_TILT straight up from below; with `wrap`, on past both poles to
// ±WRAP_TILT, as the bearing view's orbit goes. Drag on the canvas moves it
// and it moves the canvas, so the two are one number, and that number
// travels in the URL (tl=) next to θ.

import type { ReactElement } from 'react';
import type { BenchyLabels } from './benchyLabels.js';
import { MAX_TILT, MIN_TILT, WRAP_TILT, wrapTilt } from './tilt.js';

export function TiltControl({
  tilt,
  onTilt,
  labels,
  wrap = false,
}: {
  tilt: number;
  onTilt: (t: number) => void;
  labels: BenchyLabels;
  /** Run past the poles, -WRAP_TILT..WRAP_TILT. Default off. */
  wrap?: boolean;
}): ReactElement {
  const shown = Math.round(wrap ? wrapTilt(tilt) : tilt);
  return (
    <div className="theta-control">
      <label htmlFor="tilt">{labels.benchyTiltLabel}</label>
      <input
        id="tilt"
        type="range"
        min={wrap ? -WRAP_TILT : MIN_TILT}
        max={wrap ? WRAP_TILT : MAX_TILT}
        step={1}
        value={shown}
        onChange={(e) => onTilt(Number(e.target.value))}
        aria-valuetext={labels.benchyTiltValue(shown)}
      />
      <span className="theta-readout">{shown}°</span>
    </div>
  );
}
