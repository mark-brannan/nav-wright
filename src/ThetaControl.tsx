// The relative-bearing control, shared by the bearing view and the 3D views
// so all of them drive the same angle with the same control. A dial, not a
// line: the viewer's eye goes round the vessel and wraps through 359 back to
// 0. Drag the eye round the dial, or focus it and use the arrow keys. The
// focusable part is a visually hidden native range input that wraps at its
// ends, so keyboards and screen readers get a real slider.

import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react';
import { bearingLabel } from './bearing.js';
import type { SceneLabels } from './labels.js';
import { polar } from './svg.js';
import { thetaAtPoint, wrapDegrees } from './rotate.js';

/** Degrees moved by PageUp / PageDown. */
export const THETA_PAGE_STEP = 15;

/** θ for a key pressed on the control, or null to let the input handle it.
 *  The arrow keys are left to the native input (its range runs one past
 *  each end so they wrap); these are the keys whose native meaning would
 *  land on the wrong side of the wrap. */
export function thetaForKey(theta: number, key: string): number | null {
  const t = Math.round(theta);
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return 359;
    case 'PageUp':
      return wrapDegrees(t + THETA_PAGE_STEP);
    case 'PageDown':
      return wrapDegrees(t - THETA_PAGE_STEP);
    default:
      return null;
  }
}

/** θ from the native input's value, which may sit one step past either end. */
export function thetaFromInput(value: number): number {
  return wrapDegrees(Math.round(value));
}

// A pointed, generic hull for callers that don't pass a plan outline.
const DEFAULT_PLAN: [number, number][] = [
  [1, 0],
  [0.4, 0.2],
  [-0.9, 0.18],
  [-0.9, -0.18],
  [0.4, -0.2],
];

const RING = 40;
const HULL = 26;

const HIDDEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

export function ThetaControl({
  theta,
  onTheta,
  labels,
  plan = DEFAULT_PLAN,
}: {
  theta: number;
  onTheta: (t: number) => void;
  labels: SceneLabels;
  /** The hull's top-down outline (fx, py), drawn bow-up in the dial. */
  plan?: [number, number][];
}): ReactElement {
  const t = Math.round(wrapDegrees(theta)) % 360;
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef<number | null>(null);
  const aspect = labels.aspect[bearingLabel(t)];

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const next = thetaAtPoint(
      e.clientX - (r.left + r.width / 2),
      e.clientY - (r.top + r.height / 2),
    );
    if (next !== t) onTheta(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const next = thetaForKey(t, e.key);
    if (next === null) return;
    e.preventDefault();
    onTheta(next);
  };

  const hull =
    plan
      .map(
        ([fx, py], i) =>
          `${i === 0 ? 'M' : 'L'}${(py * HULL).toFixed(1)},${(-fx * HULL).toFixed(1)}`,
      )
      .join(' ') + ' Z';
  const [ex, ey] = polar(0, 0, RING, t);

  return (
    <div className="theta-control">
      <label htmlFor="theta">{labels.bearingThetaLabel}</label>
      <input
        ref={input}
        id="theta"
        className="theta-dial-input"
        style={HIDDEN}
        type="range"
        min={-1}
        max={360}
        step={1}
        value={t}
        onChange={(e) => onTheta(thetaFromInput(Number(e.target.value)))}
        onKeyDown={onKeyDown}
        aria-valuetext={labels.bearingThetaValue(t, aspect)}
      />
      <svg
        className="theta-dial"
        viewBox="-50 -50 100 100"
        width={76}
        height={76}
        aria-hidden="true"
        style={{ touchAction: 'none', cursor: 'grab', flex: 'none' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragging.current = e.pointerId;
          input.current?.focus({ preventScroll: true });
          fromPointer(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current === e.pointerId) fromPointer(e);
        }}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <circle className="theta-dial-face" r={48} fill="var(--sea-night, #0b1526)" />
        <circle
          className="theta-dial-ring"
          r={RING}
          fill="none"
          stroke="var(--grid-line, #33465f)"
          strokeWidth={1.5}
        />
        {[0, 90, 180, 270].map((d) => {
          const [x0, y0] = polar(0, 0, RING - 4, d);
          const [x1, y1] = polar(0, 0, RING + 4, d);
          return (
            <line
              key={d}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke="var(--grid-line, #33465f)"
              strokeWidth={1.5}
            />
          );
        })}
        <path
          d={hull}
          fill="var(--hull-fill, #101c30)"
          stroke="var(--hull-stroke, #3d5273)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <line
          x1={0}
          y1={0}
          x2={ex}
          y2={ey}
          stroke="var(--accent-soft, #9fc7bd)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <circle
          className="theta-dial-eye"
          cx={ex}
          cy={ey}
          r={7}
          fill="var(--accent-soft, #9fc7bd)"
          stroke="var(--sea-night, #0b1526)"
          strokeWidth={2}
        />
      </svg>
      <span className="theta-readout">
        {t}°&ensp;{aspect}
      </span>
    </div>
  );
}
