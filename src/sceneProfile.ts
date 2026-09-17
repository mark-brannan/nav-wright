// Scene -> StationProfile: the pipeline BenchyModel's Hull runs to turn a
// loaded glTF scene into the station profile anchorLights() reads. Shares
// three.js with BenchyModel but not React or @react-three/fiber, so it
// loads under a plain Node vitest environment the way test/modelTransform.ts
// already does.
//
// Split out of BenchyModel.tsx (nav-wright#38) so a consumer's own
// registration test — comparing anchorLights()'s seats against a HullSpec —
// runs the exact function the view runs, instead of a ~40-line copy that
// can drift from it.

import * as THREE from 'three';
import { PROFILE_STATIONS, placeHullModel, sampleEdges, stationProfile } from './modelTransform.js';
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
 * A clone of `scene`, placed as a vessel of `lengthMeters` the way
 * placeHullModel() defines: bow on +X, keel on the waterline, centred
 * fore-aft and athwartships. The clone leaves `scene` itself untouched.
 */
export function placeScene(scene: THREE.Object3D, lengthMeters: number): THREE.Object3D {
  const g = scene.clone(true);
  const raw = new THREE.Box3().setFromObject(scene);
  const { scale, rotationX, position } = placeHullModel(
    { min: { ...raw.min }, max: { ...raw.max } },
    lengthMeters,
  );

  g.rotation.x = rotationX;
  g.scale.setScalar(scale);
  g.position.set(...position);
  g.updateMatrixWorld(true);
  return g;
}

/**
 * Place `scene` as a vessel of `lengthMeters` and read its shape back out
 * as a StationProfile: the same pipeline BenchyModel's Hull runs, so a
 * consumer comparing anchorLights()'s seats against its own HullSpec runs
 * the view's real function rather than a re-implementation.
 */
export function profileHullModel(
  scene: THREE.Object3D,
  lengthMeters: number,
): StationProfile | null {
  const placed = placeScene(scene, lengthMeters);
  // Sample the edges at half a station so a flat roof spanning several
  // stations still registers in each of them.
  const { xyz, index } = worldMesh(placed);
  const spacing = lengthMeters / PROFILE_STATIONS / 2;
  return stationProfile(sampleEdges(xyz, index, spacing));
}
