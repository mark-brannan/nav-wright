// The 3D view holds the vessel at one on-screen size whatever her length
// (searoom#174): the scene is drawn in view units fitted to the hull, so the
// camera, which the viewer may have dragged, never has to follow a change.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  FIT_RADIUS,
  VIEW_FRAME,
  anchorLights,
  fitView,
  lightRadius,
  orbitPosition,
} from '../src/modelTransform.js';
import type { HullStations, ViewFit } from '../src/modelTransform.js';
import { placeScene, profileHullModel } from '../src/sceneProfile.js';
import { MAX_TILT } from '../src/tilt.js';

// A stand-in with Benchy's proportions in the source STL's millimetres
// (Z-up, bow on +X), off-centre so the placement has work to do.
function standIn(size: [number, number, number] = [60, 31, 48]): THREE.Object3D {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
  mesh.position.set(10, 0.5, 26);
  const root = new THREE.Group();
  root.add(mesh);
  root.updateMatrixWorld(true);
  return root;
}

const hull: HullStations = { beam: 0.22, mastX: 0.2, aftMastX: NaN, sternX: -0.88, bowX: 0.92 };
const span = { sternX: hull.sternX, bowX: hull.bowX };
const LENGTHS = [2, 7, 12, 50, 120, 400];

/** How BenchyModel's Hull fits a placed scene to the view. */
function fitOf(placedScene: THREE.Object3D): ViewFit {
  const box = new THREE.Box3().setFromObject(placedScene);
  return fitView({ min: { ...box.min }, max: { ...box.max } });
}

/** The hull as drawn: placed in metres, inside the fitted group. */
function drawn(lengthMeters: number, model = standIn()): THREE.Box3 {
  const placedScene = placeScene(model, lengthMeters, span);
  const { scale, position } = fitOf(placedScene);
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  group.position.set(...position);
  group.add(placedScene);
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group);
}

describe('view frame', () => {
  it('draws the hull the same size and in the same place at every length', () => {
    const ref = drawn(12);
    for (const L of LENGTHS) {
      const box = drawn(L);
      for (const k of ['x', 'y', 'z'] as const) {
        expect(box.min[k], `min.${k} at ${L} m`).toBeCloseTo(ref.min[k], 9);
        expect(box.max[k], `max.${k} at ${L} m`).toBeCloseTo(ref.max[k], 9);
      }
    }
  });

  it('keeps each light on the same spot of the hull at every length', () => {
    const lights = [
      { fx: 0.3, py: hull.beam, z: 0.32 }, // starboard sidelight
      { fx: hull.mastX, py: 0, z: 0.9 }, // masthead
      { fx: hull.sternX, py: 0, z: 0.3 }, // sternlight
    ];
    const seat = (L: number): number[][] => {
      const profile = profileHullModel(standIn(), L, span);
      if (!profile) throw new Error('no profile');
      const { scale, position } = fitOf(placeScene(standIn(), L, span));
      return anchorLights(lights, L, hull, profile, lightRadius(L)).map((p) =>
        p.map((v, k) => v * scale + position[k]),
      );
    };
    const ref = seat(12);
    for (const L of LENGTHS) {
      seat(L).forEach((p, i) =>
        p.forEach((v, k) => expect(v, `light ${i} axis ${k} at ${L} m`).toBeCloseTo(ref[i][k], 6)),
      );
    }
  });

  it.each([
    ['Benchy-like', [60, 31, 48]],
    ['a tall mast', [60, 12, 90]],
    ['a long low ship', [60, 8, 8]],
  ] as const)('keeps the whole of %s on the canvas from every bearing and tilt', (_, size) => {
    // The canvas's aspect ratio, from style.css (.scene-3d-stack).
    const camera = new THREE.PerspectiveCamera(VIEW_FRAME.fov, 440 / 240, VIEW_FRAME.near, VIEW_FRAME.far);
    const box = drawn(12, standIn([...size]));
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));

    for (let theta = 0; theta < 360; theta += 15) {
      for (const tilt of [0, 10, 30, 60, MAX_TILT]) {
        camera.position.set(...orbitPosition(theta, tilt));
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        for (const c of corners) {
          const p = c.clone().project(camera);
          expect(Math.abs(p.x), `x at θ ${theta}, tilt ${tilt}`).toBeLessThan(1);
          expect(Math.abs(p.y), `y at θ ${theta}, tilt ${tilt}`).toBeLessThan(1);
        }
      }
    }
  });

  it('fits every hull to the same bounding sphere at the origin', () => {
    for (const size of [[60, 31, 48], [60, 12, 90], [60, 8, 8]] as const) {
      const box = drawn(30, standIn([...size]));
      const centre = box.getCenter(new THREE.Vector3());
      expect(centre.length()).toBeCloseTo(0, 9);
      expect(box.getSize(new THREE.Vector3()).length() / 2).toBeCloseTo(FIT_RADIUS, 9);
    }
  });

  it('puts the camera ahead at theta 0 and on the starboard beam at 90', () => {
    const [ax, , az] = orbitPosition(0, 0);
    expect(ax).toBeCloseTo(VIEW_FRAME.distance, 9);
    expect(az).toBeCloseTo(0, 9);
    const [bx, , bz] = orbitPosition(90, 0);
    expect(bx).toBeCloseTo(0, 9);
    expect(bz).toBeCloseTo(VIEW_FRAME.distance, 9);
  });

  it('clamps tilt to the waterline and to MAX_TILT', () => {
    expect(orbitPosition(45, -20)).toEqual(orbitPosition(45, 0));
    expect(orbitPosition(45, 120)).toEqual(orbitPosition(45, MAX_TILT));
  });

  it('draws a box with no extent as it is rather than blowing it up', () => {
    const point = { x: 3, y: 1, z: 0 };
    expect(fitView({ min: point, max: point })).toEqual({ scale: 1, position: [0, 0, 0] });
  });
});
