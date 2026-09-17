// profileHullModel() is the scene -> StationProfile half of BenchyModel's
// Hull, factored out so a consumer's registration test can build the same
// StationProfile the view renders from, without copying the pipeline
// (nav-wright#38). This loads the package's own bundled model through
// three's real GLTFLoader, the way a consumer would.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { profileHullModel } from '../src/hullProfile.js';

// three's texture path reaches for browser globals under Node; the profile
// is geometry only (see test/hullMeshCheck.test.ts for the same stub).
const g = globalThis as Record<string, unknown>;
g.self ??= globalThis;
g.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

const MODEL_PATH = resolve(import.meta.dirname, '../models/3dbenchy-lowpoly.glb');
const LENGTH = 12;

function loadScene(file: string): Promise<THREE.Object3D> {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (gltf) => res(gltf.scene), rej);
  });
}

describe('profileHullModel', () => {
  it('profiles the bundled Benchy model at a given vessel length', async () => {
    const scene = await loadScene(MODEL_PATH);
    const profile = profileHullModel(scene, LENGTH);

    expect(profile).not.toBeNull();
    const length = profile!.maxX - profile!.minX;
    expect(length).toBeCloseTo(LENGTH, 0);
    expect(Math.max(...profile!.halfBeam)).toBeGreaterThan(0);
    expect(profile!.mast.foreX).toBeGreaterThanOrEqual(profile!.mast.aftX);
  });

  it('does not mutate the scene it is given, so a cached model can be '
    + 'profiled repeatedly at different lengths', async () => {
    const scene = await loadScene(MODEL_PATH);
    const before = new THREE.Box3().setFromObject(scene);

    profileHullModel(scene, LENGTH);

    const after = new THREE.Box3().setFromObject(scene);
    expect(after.min).toEqual(before.min);
    expect(after.max).toEqual(before.max);
  });

  it('returns null for an empty scene', () => {
    expect(profileHullModel(new THREE.Group(), LENGTH)).toBeNull();
  });
});
