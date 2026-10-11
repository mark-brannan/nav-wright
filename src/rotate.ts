// Turning the viewer round the vessel. θ is a circle, not a line: every
// control here wraps through 359 back to 0. Free of three.js so the 2D views,
// ThetaControl and the 3D view can share it.

import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/** Any angle in degrees, folded into [0, 360). */
export function wrapDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** θ after a horizontal drag of `dx` pixels on a surface `height` pixels
 *  tall. One surface height is one full turn and a rightward drag increases
 *  θ: the same rate and sense as the 3D view's orbit drag, so grabbing the
 *  vessel feels the same in every view. */
export function thetaAfterDrag(startTheta: number, dx: number, height: number): number {
  if (!(height > 0)) return wrapDegrees(Math.round(startTheta));
  return wrapDegrees(Math.round(startTheta + (dx / height) * 360));
}

/** The bearing of point (x, y) from the centre of a dial with bow up:
 *  0 straight up, 90 to the right (her starboard beam), clockwise. */
export function thetaAtPoint(x: number, y: number): number {
  if (x === 0 && y === 0) return 0;
  return wrapDegrees(Math.round((Math.atan2(x, -y) * 180) / Math.PI));
}

type Handlers<E extends Element> = {
  onPointerDown: (e: ReactPointerEvent<E>) => void;
  onPointerMove: (e: ReactPointerEvent<E>) => void;
  onPointerUp: (e: ReactPointerEvent<E>) => void;
  onPointerCancel: (e: ReactPointerEvent<E>) => void;
};

/** Pointer handlers that turn a horizontal drag on an element into θ.
 *  Pair with `touch-action: pan-y` on the element so a vertical swipe still
 *  scrolls the page on a phone. */
export function useDragRotate<E extends Element>(
  theta: number,
  onTheta: (t: number) => void,
): Handlers<E> {
  const drag = useRef<{ id: number; x: number; theta: number; last: number } | null>(null);
  const end = (e: ReactPointerEvent<E>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, theta, last: Math.round(theta) };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const height = e.currentTarget.getBoundingClientRect().height;
      const next = thetaAfterDrag(d.theta, e.clientX - d.x, height);
      if (next === d.last) return;
      d.last = next;
      onTheta(next);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
