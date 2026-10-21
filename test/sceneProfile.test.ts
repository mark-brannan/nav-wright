// placeScene() reads what a mesh says about its own frame from its glTF
// extras, the way three's GLTFLoader delivers them (node extras land in
// userData): a traced vessel's waterline and hull extent.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { meshCatalog } from '../src/meshCatalog.js';
import { SAIL_MATERIAL, modelFrame, placeScene, profileHullModel } from '../src/sceneProfile.js';

const FILE = new URL('../models/westsail-32.glb', import.meta.url);
const L = 9.75;
const span = { sternX: -0.88, bowX: 0.92 };

let scene: THREE.Object3D;
beforeAll(async () => {
  const buf = readFileSync(FILE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  scene = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (g) => resolve(g.scene), reject);
  });
});

/** World-space box of the meshes whose material is `name`. */
function partBox(root: THREE.Object3D, name: string): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === name) box.expandByObject(m);
  });
  return box;
}

describe('modelFrame', () => {
  it('reads the waterline and hull extent a traced vessel names', () => {
    expect(modelFrame(scene)).toEqual({ waterlineZ: 0, hullX: [-1, 1] });
  });
  it('is empty for a mesh that names nothing', () => {
    expect(modelFrame(new THREE.Group())).toEqual({});
  });
});

describe('placeScene with a mesh that names its frame', () => {
  it('fits the hull, not the bowsprit, to the span', () => {
    const placed = placeScene(scene, L, span);
    const hull = partBox(placed, 'topsides');
    const rig = partBox(placed, 'rig');
    expect(hull.min.x).toBeCloseTo((span.sternX * L) / 2, 1);
    expect(hull.max.x).toBeCloseTo((span.bowX * L) / 2, 1);
    // The spars reach past both ends of the hull.
    expect(rig.max.x).toBeGreaterThan(hull.max.x + 0.5);
    expect(rig.min.x).toBeLessThan(hull.min.x - 0.2);
  });
  it('floats her on her waterline, keel under the water', () => {
    const placed = placeScene(scene, L, span);
    const hull = partBox(placed, 'bottom');
    expect(hull.min.y).toBeLessThan(-1);
    expect(hull.max.y).toBeGreaterThan(0);
  });
});

describe('a traced mesh sets her sails', () => {
  it('draws sail cloth between the spars, inside the rig', () => {
    const placed = placeScene(scene, L, span);
    const sails = partBox(placed, SAIL_MATERIAL);
    const rig = partBox(placed, 'rig');
    expect(sails.isEmpty()).toBe(false);
    // Clear of the deck and up to the masthead, never past it.
    expect(sails.max.y).toBeGreaterThan(0.8 * rig.max.y);
    expect(sails.max.y).toBeLessThanOrEqual(rig.max.y + 1e-6);
    expect(sails.min.y).toBeGreaterThan(0);
  });
  it('winds each sail both ways, so either side is a front face', () => {
    let tris = 0;
    let faceOn = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m.material as THREE.Material).name !== SAIL_MATERIAL) return;
      const n = m.geometry.getAttribute('normal');
      tris += n.count / 3;
      for (let i = 0; i < n.count; i += 3) faceOn += Math.sign(n.getY(i));
    });
    expect(tris).toBeGreaterThan(0);
    expect(faceOn).toBe(0);
  });
});

/** A traced mesh, loaded the way the views load it. */
async function load(file: string): Promise<THREE.Object3D> {
  const buf = readFileSync(new URL(`../models/${file}`, import.meta.url));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(ab as ArrayBuffer, '', (g) => resolve(g.scene), reject);
  });
}

describe('lights are never seated on the sails', () => {
  const traced = meshCatalog.filter((r) => r.kind === 'traced').map((r) => r.file);
  it.each(traced)('%s profiles the same with her cloth taken off', async (file) => {
    const rigged = await load(file);
    const bare = rigged.clone(true);
    const cloth: THREE.Object3D[] = [];
    bare.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === SAIL_MATERIAL) cloth.push(m);
    });
    expect(cloth.length).toBeGreaterThan(0);
    for (const o of cloth) o.removeFromParent();
    // As the catalog measures her (scripts/mesh-catalog.mjs): a mainsail's
    // leech overhanging the stern station must not lift her sternlight.
    const full = { sternX: -1, bowX: 1 };
    expect(profileHullModel(rigged, 2, full)).toEqual(profileHullModel(bare, 2, full));
  });
});
