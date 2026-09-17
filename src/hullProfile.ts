// Scene -> StationProfile: the half of the pipeline that needs three.js to
// read a loaded model's geometry, kept out of modelTransform.ts so that
// file stays unit-testable with plain numbers. BenchyModel's Hull calls
// this; so does anything else that needs the same StationProfile a loaded
// scene produces, built exactly the way the view builds it (nav-wright#38).

import * as THREE from 'three';
import {
  PROFILE_STATIONS,
  placeHullModel,
  sampleEdges,
  stationProfile,
} from './modelTransform.js';
import type { StationProfile } from './modelTransform.js';

/** Every mesh under `root` as one world-space triangle list: flat xyz
 * vertices and a merged index. */
function worldMesh(root: THREE.Object3D): { xyz: Float32Array; index: number[] } {
  const chunks: Float32Array[] = [];
  const index: number[] = [];
  let total = 0;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geom = o.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position');
    if (!pos) return;
    const out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      out[i * 3] = v.x;
      out[i * 3 + 1] = v.y;
      out[i * 3 + 2] = v.z;
    }
    const base = total / 3;
    if (geom.index) {
      for (let i = 0; i < geom.index.count; i++) index.push(base + geom.index.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) index.push(base + i);
    }
    chunks.push(out);
    total += out.length;
  });
  const xyz = new Float32Array(total);
  let at = 0;
  for (const c of chunks) {
    xyz.set(c, at);
    at += c.length;
  }
  return { xyz, index };
}

/**
 * Clones `scene` and places it at `lengthMeters` the way `Hull` renders it:
 * scaled, rotated onto three's axes, centred and resting on the waterline.
 * `scene` itself is left untouched, so a cached `useGLTF` result can be
 * placed again at a different length.
 */
export function placeHullScene(scene: THREE.Object3D, lengthMeters: number): THREE.Object3D {
  const group = scene.clone(true);
  const raw = new THREE.Box3().setFromObject(scene);
  const { scale, rotationX, position } = placeHullModel(
    { min: { ...raw.min }, max: { ...raw.max } },
    lengthMeters,
  );

  group.rotation.x = rotationX;
  group.scale.setScalar(scale);
  group.position.set(...position);
  return group;
}

/**
 * Places a loaded hull model at `lengthMeters` (see `placeHullScene`) and
 * reads its shape back as a `StationProfile`. Returns null when the scene
 * has no geometry to profile.
 */
export function profileHullModel(
  scene: THREE.Object3D,
  lengthMeters: number,
): StationProfile | null {
  const group = placeHullScene(scene, lengthMeters);
  group.updateMatrixWorld(true);

  // Sample the edges at half a station so a flat roof spanning several
  // stations still registers in each of them.
  const { xyz, index } = worldMesh(group);
  const spacing = lengthMeters / PROFILE_STATIONS / 2;
  return stationProfile(sampleEdges(xyz, index, spacing));
}
