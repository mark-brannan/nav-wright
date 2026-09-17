// nav-wright/profile: the exported station-profile math plus the
// scene-to-profile pipeline (nav-wright#38). The pure math itself is
// covered by modelTransform.test.ts; this checks the subpath actually
// re-exports it, and that profileHullModel() runs the same placement +
// sampling pipeline BenchyModel's Hull does.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROFILE_STATIONS,
  anchorLights,
  bowShoulder,
  lightPosition,
  placeHullModel,
  profileHullModel,
  sampleEdges,
  stationAt,
  stationProfile,
} from '../src/profile.js';

describe('nav-wright/profile', () => {
  it('re-exports the pure station-profile API', () => {
    for (const fn of [
      placeHullModel,
      sampleEdges,
      stationProfile,
      stationAt,
      bowShoulder,
      anchorLights,
      lightPosition,
    ]) {
      expect(typeof fn).toBe('function');
    }
    expect(PROFILE_STATIONS).toBeGreaterThan(0);
  });

  it('returns null for a scene with no mesh', () => {
    expect(profileHullModel(new THREE.Group(), 20)).toBeNull();
  });

  it('places and profiles a scene the way placeHullModel places it', () => {
    // A 40x20x10 box in the source frame (x fore-aft, y beam, z height),
    // scaled to a 20m vessel: scale 0.5, so world x in [-10, 10], world
    // height (from local z) in [0, 5], world beam (from local y) in
    // [-5, 5].
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 10));
    const scene = new THREE.Group();
    scene.add(mesh);

    const profile = profileHullModel(scene, 20);
    expect(profile).not.toBeNull();
    expect(profile!.minX).toBeCloseTo(-10, 6);
    expect(profile!.maxX).toBeCloseTo(10, 6);
    expect(Math.max(...profile!.halfBeam)).toBeCloseTo(5, 1);
    expect(Math.max(...profile!.top)).toBeCloseTo(5, 1);
  });

  it('does not mutate the scene it profiles', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 10));
    const scene = new THREE.Group();
    scene.add(mesh);
    const before = scene.position.clone();

    profileHullModel(scene, 20);

    expect(scene.position.equals(before)).toBe(true);
    expect(scene.rotation.x).toBe(0);
  });
});
