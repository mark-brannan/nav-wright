// placeScene() reads what a mesh says about its own frame from its glTF
// extras, the way three's GLTFLoader delivers them (node extras land in
// userData): a traced vessel's waterline and hull extent.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { modelFrame, placeScene } from '../src/sceneProfile.js';

const FILE = new URL('../models/westsail-32-lines.glb', import.meta.url);
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
