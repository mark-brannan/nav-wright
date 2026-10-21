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
import type { HullSpan, StationProfile } from './modelTransform.js';

/**
 * The material a mesh's sails are drawn in (scripts/sailboat-lines.mjs).
 * Cloth carries no light, so the profile lights are seated on leaves it out:
 * a mainsail's leech over the transom is not where her sternlight goes.
 */
export const SAIL_MATERIAL = 'sails';

const isSail = (o: THREE.Mesh): boolean =>
  (Array.isArray(o.material) ? o.material : [o.material]).every((m) => m?.name === SAIL_MATERIAL);

/** Every mesh under `root` but its sails as one world-space triangle list:
 * flat xyz vertices and a merged index. */
function worldMesh(root: THREE.Object3D): { xyz: Float32Array; index: number[] } {
  const chunks: Float32Array[] = [];
  const index: number[] = [];
  let total = 0;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || isSail(o)) return;
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

/** What a mesh says about its own frame, from a node's glTF extras (three
 * lands them in `userData`; scripts/sailboat-lines.mjs writes them): its
 * waterline height, and the fore-aft extent of the hull itself when spars
 * reach past it. Each is undefined when no node names it. */
export interface ModelFrame {
  waterlineZ?: number;
  hullX?: [number, number];
}

export function modelFrame(scene: THREE.Object3D): ModelFrame {
  const frame: ModelFrame = {};
  scene.traverse((o) => {
    const { waterlineZ, hullX } = o.userData as { waterlineZ?: unknown; hullX?: unknown };
    if (frame.waterlineZ === undefined && typeof waterlineZ === 'number')
      frame.waterlineZ = waterlineZ;
    if (
      frame.hullX === undefined &&
      Array.isArray(hullX) &&
      hullX.length === 2 &&
      hullX.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
      hullX[1] > hullX[0]
    )
      frame.hullX = [hullX[0], hullX[1]];
  });
  return frame;
}

/**
 * A clone of `scene`, placed as a vessel of `lengthMeters` the way
 * placeHullModel() defines: bow on +X, afloat on the waterline (the keel on
 * it unless the model names its own waterline, see modelFrame), fitted to
 * the hull `span` if one is given (else centred fore-aft over the full
 * length). The fit is by the hull's own extent when the model names one, so
 * a bowsprit does not shorten her. The clone leaves `scene` itself untouched.
 */
export function placeScene(
  scene: THREE.Object3D,
  lengthMeters: number,
  span?: HullSpan,
): THREE.Object3D {
  const g = scene.clone(true);
  const raw = new THREE.Box3().setFromObject(scene);
  const { waterlineZ, hullX } = modelFrame(scene);
  const { scale, rotationX, position } = placeHullModel(
    {
      min: { ...raw.min, x: hullX ? hullX[0] : raw.min.x },
      max: { ...raw.max, x: hullX ? hullX[1] : raw.max.x },
    },
    lengthMeters,
    span,
    waterlineZ,
  );

  g.rotation.x = rotationX;
  g.scale.setScalar(scale);
  g.position.set(...position);
  g.updateMatrixWorld(true);
  return g;
}

/**
 * Place `scene` as a vessel of `lengthMeters` (fitted to `span`, if given)
 * and read its shape back out as a StationProfile: the same pipeline
 * BenchyModel's Hull runs, so a consumer comparing anchorLights()'s seats
 * against its own HullSpec runs the view's real function rather than a
 * re-implementation.
 */
export function profileHullModel(
  scene: THREE.Object3D,
  lengthMeters: number,
  span?: HullSpan,
): StationProfile | null {
  const placed = placeScene(scene, lengthMeters, span);
  // Sample the edges at half a station so a flat roof spanning several
  // stations still registers in each of them.
  const { xyz, index } = worldMesh(placed);
  const spacing = lengthMeters / PROFILE_STATIONS / 2;
  return stationProfile(sampleEdges(xyz, index, spacing));
}
