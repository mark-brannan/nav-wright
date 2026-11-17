// The bearing view's tilt wraps past the poles (#117): the camera goes over
// her and on, upside down. What is pinned here is what the viewer is shown:
// where the camera stands, which way is up on screen, and which lights a
// viewer there sees.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderToStaticMarkup } from 'react-dom/server';
import { BearingModelView } from '../src/BearingModelView.js';
import { defaultBenchyLabels } from '../src/benchyLabels.js';
import { selectHull } from '../src/hulls.js';
import { VIEW_FRAME, orbitCamera, orbitPosition } from '../src/modelTransform.js';
import type { PlacedLight } from '../src/placement.js';
import { DEFAULT_TILT, thetaFor, viewerAt, wrapTilt } from '../src/tilt.js';

describe('wrapTilt', () => {
  it.each([
    [0, 0],
    [90, 90],
    [-90, -90],
    [180, 180],
    [-180, 180],
    [190, -170],
    [-190, 170],
    [450, 90],
    [540, 180],
    [-360, 0],
  ])('wraps %s to %s', (tilt, wrapped) => {
    expect(wrapTilt(tilt)).toBe(wrapped);
  });

  it('reads nonsense as the default', () => {
    expect(wrapTilt(NaN)).toBe(DEFAULT_TILT);
    expect(wrapTilt(Infinity)).toBe(DEFAULT_TILT);
  });
});

describe('viewerAt', () => {
  it.each([
    [0, 10, 0, 10, false],
    [45, 90, 45, 90, false],
    [45, -90, 45, -90, false],
    [0, 100, 180, 80, true],
    [30, -100, 210, -80, true],
    [0, 180, 180, 0, true],
    [270, 135, 90, 45, true],
    [200, 370, 200, 10, false],
  ])('orbit (%s, %s) stands at bearing %s, elevation %s, inverted %s', (theta, tilt, b, e, inv) => {
    const v = viewerAt(theta, tilt);
    expect(v.bearing).toBeCloseTo(b, 9);
    expect(v.elevation).toBeCloseTo(e, 9);
    expect(v.inverted).toBe(inv);
  });

  it('thetaFor puts the viewer back at the bearing asked, either side of a pole', () => {
    for (const tilt of [10, 89, 91, 120, 180, -150, -91]) {
      for (let b = 0; b < 360; b += 15) {
        expect(viewerAt(thetaFor(b, tilt), tilt).bearing).toBeCloseTo(b, 9);
      }
    }
  });
});

type V = [number, number, number];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('orbitCamera', () => {
  it('is orbitPosition within the poles', () => {
    for (const tilt of [-90, -45, 0, 10, 60, 90]) {
      for (const theta of [0, 45, 90, 200, 359]) {
        const { position } = orbitCamera(theta, tilt);
        orbitPosition(theta, tilt).forEach((c, i) => expect(position[i]).toBeCloseTo(c, 9));
      }
    }
  });

  it('moves the camera smoothly over both poles and across the wrap at 180', () => {
    // One degree of arc at VIEW_FRAME.distance, with room for rounding.
    const step = VIEW_FRAME.distance * (Math.PI / 180) * 1.001;
    for (const theta of [0, 37, 90, 250]) {
      let prev = orbitCamera(theta, -180);
      for (let tilt = -179; tilt <= 180; tilt++) {
        const next = orbitCamera(theta, tilt);
        expect(dist(prev.position, next.position)).toBeLessThan(step);
        // The up turns as the camera does, never flips in a frame.
        expect(dist(prev.up, next.up)).toBeLessThan((Math.PI / 180) * 1.001);
        prev = next;
      }
    }
  });

  it('keeps a unit up square to the line of sight, poles included', () => {
    for (let tilt = -180; tilt <= 180; tilt += 5) {
      for (const theta of [0, 90, 133]) {
        const { position, up } = orbitCamera(theta, tilt);
        expect(Math.hypot(...up)).toBeCloseTo(1, 9);
        expect(dot(position, up)).toBeCloseTo(0, 9);
      }
    }
  });

  function project(theta: number, tilt: number, p: THREE.Vector3): THREE.Vector3 {
    const c = new THREE.PerspectiveCamera(
      VIEW_FRAME.fov,
      VIEW_FRAME.aspect,
      VIEW_FRAME.near,
      VIEW_FRAME.far,
    );
    const { position, up } = orbitCamera(theta, tilt);
    c.position.set(...position);
    c.up.set(...up);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld(true);
    return p.clone().project(c);
  }

  const masthead = new THREE.Vector3(0, 0.3, 0);
  const bow = new THREE.Vector3(0.5, 0, 0);

  it('draws her mast up the screen within the poles and down it past one', () => {
    expect(project(90, 10, masthead).y).toBeGreaterThan(0);
    expect(project(90, 170, masthead).y).toBeLessThan(0);
    expect(project(90, -170, masthead).y).toBeLessThan(0);
  });

  it('past a pole, the bow lies where the far side would put it, flipped', () => {
    // Seen from her starboard beam the bow is to the right of the frame; from
    // the port beam, to the left; over the top to the port side, upside
    // down, the left and right swap back: to the right.
    expect(project(90, 10, bow).x).toBeGreaterThan(0);
    expect(project(270, 10, bow).x).toBeLessThan(0);
    expect(project(90, 170, bow).x).toBeGreaterThan(0);
  });
});

const light = (lightId: string, from_deg: number, to_deg: number): PlacedLight => ({
  key: lightId,
  lightId,
  color: '#ffffff',
  character: 'steady',
  arc: { from_deg, to_deg },
  fx: 0,
  py: 0,
  z: 0.5,
  sourceEntry: 'test',
});
const masthead = light('light:masthead', 247.5, 112.5);
const stern = light('light:sternlight', 112.5, 247.5);
const hull = selectHull({});
const noop = () => {};

const render = (
  theta: number,
  tilt: number,
  placed: PlacedLight[],
  verticalSector = false,
): string =>
  renderToStaticMarkup(
    <BearingModelView
      modelUrl="/nowhere.glb"
      hull={hull}
      placed={placed}
      facts={{ 'fact:propulsion': 'propulsion:power' }}
      theta={theta}
      onTheta={noop}
      tilt={tilt}
      onTilt={noop}
      hullHint={0}
      verticalSector={verticalSector}
    />,
  );
const empty = 'bearing-empty-overlay';

describe('BearingModelView past a pole', () => {
  it('shows the lights of the bearing the camera has gone over to', () => {
    // Orbit heading dead ahead, gone over the top: the viewer is astern.
    expect(render(0, 150, [masthead])).toContain(empty);
    expect(render(0, 150, [stern])).not.toContain(empty);
    expect(render(0, 30, [masthead])).not.toContain(empty);
    expect(render(0, 30, [stern])).toContain(empty);
  });

  it('names the bearing the viewer stands at', () => {
    expect(render(0, 150, [stern])).toContain(
      `aria-label="${defaultBenchyLabels.bearingAlt(180)}"`,
    );
  });

  it('dims by the elevation the viewer is at, with the vertical sector on', () => {
    // 100 is 80 above the far waterline, nearly overhead; 170 is 10 above it.
    expect(render(0, 100, [stern], true)).toContain(empty);
    expect(render(180, 80, [stern], true)).toContain(empty);
    expect(render(0, 170, [stern], true)).not.toContain(empty);
    expect(render(180, 10, [stern], true)).not.toContain(empty);
  });
});
