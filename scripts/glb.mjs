// Writes a flat-shaded glTF binary from named triangle lists: one primitive
// per part, one unlit-looking PBR material each, face normals, no index and
// no textures. Shared by loft-hulls.mjs and sailboat-lines.mjs so the two
// lofts cannot drift in how they serialise. Deterministic for the same input.

/** Flat normals: every vertex of a triangle gets that triangle's normal. */
export function faceNormals(pos) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i],
      uy = pos[i + 4] - pos[i + 1],
      uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i],
      vy = pos[i + 7] - pos[i + 1],
      vz = pos[i + 8] - pos[i + 2];
    let x = uy * vz - uz * vy,
      y = uz * vx - ux * vz,
      z = ux * vy - uy * vx;
    const l = Math.hypot(x, y, z) || 1;
    x /= l;
    y /= l;
    z /= l;
    for (let k = 0; k < 3; k++) n.set([x, y, z], i + 3 * k);
  }
  return n;
}

/**
 * `parts` maps a material name to `{ pos: number[] }`, flat xyz triangles;
 * `colours` maps the same names to [r, g, b] in 0..1. `extras`, when given,
 * lands on the scene's root node, where three's GLTFLoader exposes it as
 * `userData` (sceneProfile.ts reads `waterlineZ` from there).
 */
export function glb(parts, id, { generator, colours, extras } = {}) {
  const chunks = [];
  let offset = 0;
  const node = { mesh: 0, name: id };
  if (extras) node.extras = extras;
  const gltf = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [node],
    meshes: [{ name: id, primitives: [] }],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  for (const [name, part] of Object.entries(parts)) {
    if (part.pos.length === 0) continue;
    const pos = new Float32Array(part.pos);
    const nor = faceNormals(pos);
    const prim = { attributes: {}, material: gltf.materials.length };
    gltf.materials.push({
      name,
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorFactor: [...colours[name], 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    });
    for (const [attr, data] of [
      ['POSITION', pos],
      ['NORMAL', nor],
    ]) {
      const bytes = new Uint8Array(data.buffer);
      gltf.bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: bytes.length,
        target: 34962,
      });
      const acc = {
        bufferView: gltf.bufferViews.length - 1,
        componentType: 5126,
        count: data.length / 3,
        type: 'VEC3',
      };
      if (attr === 'POSITION') {
        acc.min = [0, 1, 2].map((k) => Math.min(...data.filter((_, i) => i % 3 === k)));
        acc.max = [0, 1, 2].map((k) => Math.max(...data.filter((_, i) => i % 3 === k)));
      }
      gltf.accessors.push(acc);
      prim.attributes[attr] = gltf.accessors.length - 1;
      chunks.push(bytes);
      offset += bytes.length;
    }
    gltf.meshes[0].primitives.push(prim);
  }
  gltf.buffers.push({ byteLength: offset });
  const bin = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const pad = (b, fill) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20);
  const body = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
  const ch = (len, type) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  return Buffer.concat([
    header,
    ch(json.length, 0x4e4f534a),
    json,
    ch(body.length, 0x004e4942),
    body,
  ]);
}
