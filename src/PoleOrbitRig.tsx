// The bearing view's orbit (#117): OrbitControls stops at the poles, since
// past one the camera's up must flip, and it keeps a fixed up. This rig
// keeps the orbit as two numbers, theta and a tilt that wraps like theta
// (tilt.ts), seats the camera from them with its up along the tilt's great
// circle (orbitUp), and drags them directly, so the camera goes over her and
// carries on. Rotate and zoom only: the bearing view never pans, the orbit
// centre is pinned to the vessel.

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { VIEW_FRAME, orbitCamera } from './modelTransform.js';
import { viewerAt, wrapTilt } from './tilt.js';

/** Within whole-degree rounding of each other, across the wrap. */
const near = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) <= 0.5 + 1e-9;
const wrap360 = (t: number) => ((t % 360) + 360) % 360;

/** Degrees of orbit per pixel of drag, as OrbitControls turns: a drag the
 * canvas's height goes once round. */
const degPerPixel = (el: HTMLElement) => 360 / Math.max(1, el.clientHeight);
/** One wheel step's change of distance, as OrbitControls zooms. */
const ZOOM_STEP = 0.95;

const clampDistance = (d: number) =>
  Math.min(VIEW_FRAME.maxDistance, Math.max(VIEW_FRAME.minDistance, d));

export function PoleOrbitRig({
  theta,
  onTheta,
  tilt,
  onTilt,
  onSeen,
  level = false,
}: {
  theta: number;
  onTheta?: (t: number) => void;
  /** Wraps into (-180, 180]; past ±90 the camera is over a pole. */
  tilt: number;
  onTilt?: (t: number) => void;
  /** The bearing the camera stands at (viewerAt), each time a drag moves it. */
  onSeen?: (bearing: number) => void;
  /** Pin the camera to the waterline's level (tilt 0): the silhouette. */
  level?: boolean;
}): null {
  const camera = useThree((s) => s.camera);
  const el = useThree((s) => s.gl.domElement);
  // The orbit as dragged, unrounded, and the distance zoomed to.
  const orbit = useRef<{ theta: number; tilt: number; distance: number }>({
    theta,
    tilt: level ? 0 : wrapTilt(tilt),
    distance: VIEW_FRAME.distance,
  });
  // The last whole angles this rig reported: our own report coming back as
  // a prop must not re-seat the camera mid-drag.
  const reported = useRef<{ theta: number; tilt: number; seat?: boolean } | null>(null);
  const levelRef = useRef(level);
  levelRef.current = level;
  const on = useRef({ onTheta, onTilt, onSeen });
  on.current = { onTheta, onTilt, onSeen };

  const seat = useRef(() => {});
  seat.current = () => {
    const { theta: th, tilt: tl, distance } = orbit.current;
    const { position, up } = orbitCamera(th, tl, distance);
    camera.position.set(...position);
    camera.up.set(...up);
    camera.lookAt(0, 0, 0);
  };

  useEffect(() => {
    const want = level ? 0 : wrapTilt(tilt);
    const r = reported.current;
    if (r && !r.seat && near(r.theta, theta) && near(r.tilt, want)) return;
    reported.current = { theta, tilt: want, seat: true };
    orbit.current = { ...orbit.current, theta, tilt: want };
    seat.current();
  }, [theta, tilt, level]);

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>();
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const report = () => {
      const th = Math.round(orbit.current.theta);
      const tl = Math.round(orbit.current.tilt);
      const next = { theta: wrap360(th), tilt: wrapTilt(tl) };
      const r = reported.current;
      const sameTheta = r !== null && near(r.theta, next.theta);
      const sameTilt = r !== null && near(r.tilt, next.tilt);
      if (sameTheta && sameTilt) return;
      reported.current = next;
      on.current.onSeen?.(viewerAt(next.theta, next.tilt).bearing);
      if (!sameTheta) on.current.onTheta?.(next.theta);
      if (!sameTilt) on.current.onTilt?.(next.tilt);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      el.setPointerCapture?.(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      if (pointers.size >= 2) {
        const before = spread();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = spread();
        if (before > 0 && after > 0) {
          orbit.current.distance = clampDistance((orbit.current.distance * before) / after);
          seat.current();
        }
        return;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const k = degPerPixel(el);
      const o = orbit.current;
      // Upside down, the screen's right is the world's left: turn her the
      // way the hand moves.
      const turn = viewerAt(o.theta, o.tilt).inverted ? -1 : 1;
      o.theta = wrap360(o.theta + turn * (e.clientX - last.x) * k);
      // Down the screen raises the camera, as OrbitControls does, and on over the pole.
      if (!levelRef.current) o.tilt = wrapTilt(o.tilt + (e.clientY - last.y) * k);
      seat.current();
      report();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      el.releasePointerCapture?.(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const d = orbit.current.distance;
      orbit.current.distance = clampDistance(e.deltaY < 0 ? d * ZOOM_STEP : d / ZOOM_STEP);
      seat.current();
    };
    const touchAction = el.style.touchAction;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.style.touchAction = touchAction;
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [el]);

  return null;
}
