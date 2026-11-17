// Projects every models/<stem>.glb to models/<stem>-profile.svg (from
// starboard, bow right) and models/<stem>-plan.svg (from above, bow up),
// and writes docs/mesh-projections.md, a contact sheet of both views per
// mesh (docs/design/mesh-catalog.md, nav-wright#150). Each mesh is placed
// as the catalog measures it: hull extent fitted to [-1, 1], waterline at
// 0, so the drawings' units are the hull's half-length. A triangle is
// painted its material's colour, times its texture at the triangle's
// centre when it has one (the kit meshes' colour atlas).
//
//   npm run build && node scripts/mesh-projections.mjs
//
// Deterministic for the same meshes.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { format, resolveConfig } from 'prettier';
import { loopsPath, projectTriangles } from '../dist/meshProjection.js';
import { placeScene } from '../dist/sceneProfile.js';
import { SEA_COLOR, SILHOUETTE_COLOR } from '../dist/silhouette.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'models');
const SHEET = join(ROOT, 'docs', 'mesh-projections.md');
const WATERLINE = '#3d7fb0';
// SVG pixels per half-length when the drawing is shown at its own size.
const SHOWN = 200;

// three's texture path reaches for browser globals under Node; the pixels
// are read here from the glb itself.
globalThis.self ??= globalThis;
globalThis.createImageBitmap ??= async () => ({ width: 1, height: 1, close() {} });

/** The glb's JSON and binary chunks. */
function readGlb(buf) {
  let at = 12;
  const out = {};
  while (at < buf.length) {
    const len = buf.readUInt32LE(at);
    const type = buf.readUInt32LE(at + 4);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === 0x4e4f534a) out.json = JSON.parse(body.toString('utf8'));
    if (type === 0x004e4942) out.bin = body;
    at += 8 + len;
  }
  return out;
}

/** An 8-bit, non-interlaced PNG as RGBA rows: enough for a colour atlas. */
function decodePng(buf) {
  let at = 8;
  let ihdr;
  let plte;
  let trns;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const [depth, colour, , , interlace] = ihdr.subarray(8, 13);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colour];
  if (depth !== 8 || interlace !== 0 || !channels)
    throw new Error(`PNG depth ${depth}, colour type ${colour}, interlace ${interlace}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      px[y * stride + x] = (src[x] + pred) & 0xff;
    }
  }
  const rgba = (x, y) => {
    const i = y * stride + x * channels;
    if (colour === 3) {
      const k = px[i];
      return [plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255];
    }
    if (colour === 0 || colour === 4) return [px[i], px[i], px[i], colour === 4 ? px[i + 1] : 255];
    return [px[i], px[i + 1], px[i + 2], colour === 6 ? px[i + 3] : 255];
  };
  return { width, height, rgba };
}

/** Nearest texel at glTF uv, repeat-wrapped; uv's origin is the image's top left. */
function sampler(image) {
  const wrap = (t, n) => ((Math.floor(t * n) % n) + n) % n;
  return (u, v) => image.rgba(wrap(u, image.width), wrap(v, image.height));
}

async function load(file) {
  const buf = readFileSync(file);
  const { json, bin } = readGlb(buf);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(ab, '', resolve, reject));
  const images = (json.images ?? []).map((im) => {
    const view = json.bufferViews[im.bufferView];
    return sampler(decodePng(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)));
  });
  /** For a three material, its glTF base-colour texture sampler and uv transform, if any. */
  const textureOf = (material) => {
    const ref = gltf.parser.associations.get(material);
    const info = ref && json.materials[ref.materials]?.pbrMetallicRoughness?.baseColorTexture;
    if (!info) return null;
    const t = info.extensions?.KHR_texture_transform ?? {};
    if (t.rotation) throw new Error(`${file}: rotated texture transform`);
    if ((info.texCoord ?? t.texCoord ?? 0) !== 0) throw new Error(`${file}: second uv set`);
    return {
      sample: images[json.textures[info.index].source],
      offset: t.offset ?? [0, 0],
      scale: t.scale ?? [1, 1],
    };
  };
  return { scene: gltf.scene, textureOf };
}

/** The placed mesh as flat world triangles, one paint per triangle, and the paints' colours. */
function paintedTriangles(scene, textureOf) {
  const placed = placeScene(scene, 2, { sternX: -1, bowX: 1 });
  const xyz = [];
  const paint = [];
  const colours = [];
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const paintOf = (hex) => {
    let k = colours.indexOf(hex);
    if (k < 0) k = colours.push(hex) - 1;
    return k;
  };
  placed.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geom = o.geometry;
    const pos = geom.getAttribute('position');
    const uv = geom.getAttribute('uv');
    const material = Array.isArray(o.material) ? o.material[0] : o.material;
    const tex = textureOf(material);
    const count = geom.index ? geom.index.count : pos.count;
    const vertex = (k) => (geom.index ? geom.index.getX(k) : k);
    for (let k = 0; k + 2 < count; k += 3) {
      const ids = [vertex(k), vertex(k + 1), vertex(k + 2)];
      for (const id of ids) {
        v.fromBufferAttribute(pos, id).applyMatrix4(o.matrixWorld);
        xyz.push(v.x, v.y, v.z);
      }
      c.copy(material.color);
      if (tex && uv) {
        const u = ids.reduce((s, id) => s + uv.getX(id), 0) / 3;
        const w = ids.reduce((s, id) => s + uv.getY(id), 0) / 3;
        const [r, g, b] = tex.sample(u * tex.scale[0] + tex.offset[0], w * tex.scale[1] + tex.offset[1]);
        c.multiply(new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
      }
      paint.push(paintOf(`#${c.getHexString(THREE.SRGBColorSpace)}`));
    }
  });
  return { xyz, paint, colours };
}

const r4 = (x) => {
  const r = Math.round(x * 1e4) / 1e4;
  return r === 0 ? 0 : r;
};

function svg(projection, colours, { title, view }) {
  const { u, v } = projection.bounds;
  const profile = view.kind === 'profile';
  // SVG y is down: the top of the drawing is -v1, and a profile keeps her waterline in frame.
  const top = -v[1];
  const bottom = profile ? Math.max(-v[0], 0) : -v[0];
  const m = 0.04 * Math.max(u[1] - u[0], bottom - top);
  const box = [u[0] - m, top - m, u[1] - u[0] + 2 * m, bottom - top + 2 * m].map(r4);
  const outline = loopsPath(projection.outline);
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" width="${Math.round(box[2] * SHOWN)}" height="${Math.round(box[3] * SHOWN)}" data-view="${view.kind}"${profile ? ` data-bearing="${view.bearing}"` : ''} data-u="${u.map(r4).join(' ')}" data-v="${v.map(r4).join(' ')}">`,
    `<title>${title}</title>`,
    `<path d="${outline}" fill="${SILHOUETTE_COLOR}" fill-rule="evenodd"/>`,
    // Each paint is stroked in its own colour too, closing the hairline seams
    // that separately simplified neighbours leave between them.
    ...projection.layers.map(
      (l) =>
        `<path d="${loopsPath(l.loops)}" fill="${colours[l.paint]}" fill-rule="evenodd" stroke="${colours[l.paint]}" stroke-width="0.75" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    ),
    `<path d="${outline}" fill="none" stroke="${SEA_COLOR}" stroke-width="1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
  ];
  if (profile)
    lines.push(
      `<line x1="${box[0]}" y1="0" x2="${r4(box[0] + box[2])}" y2="0" stroke="${WATERLINE}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    );
  lines.push('</svg>');
  return lines.join('\n') + '\n';
}

const catalog = JSON.parse(readFileSync(join(MODELS, 'catalog.json'), 'utf8'));
const names = new Map(catalog.map((r) => [r.file, r]));
const glbs = readdirSync(MODELS)
  .filter((f) => f.endsWith('.glb'))
  .sort();
const VIEWS = [
  ['profile', { kind: 'profile', bearing: 90 }, 'profile from starboard'],
  ['plan', { kind: 'plan' }, 'plan from above'],
];
const rows = [];
let bytes = 0;
for (const glb of glbs) {
  const stem = glb.slice(0, -4);
  const record = names.get(glb);
  if (!record) throw new Error(`models/${glb} is not in models/catalog.json; run npm run catalog`);
  const { scene, textureOf } = await load(join(MODELS, glb));
  const { xyz, paint, colours } = paintedTriangles(scene, textureOf);
  for (const [suffix, view, words] of VIEWS) {
    const text = svg(projectTriangles(xyz, paint, view), colours, {
      title: `${record.name}, ${words}`,
      view,
    });
    writeFileSync(join(MODELS, `${stem}-${suffix}.svg`), text);
    bytes += text.length;
  }
  rows.push(
    `| ${record.name}<br>\`${glb}\` | ${record.fidelity} | <img src="../models/${stem}-profile.svg" height="120"> | <img src="../models/${stem}-plan.svg" height="120"> |`,
  );
  console.log(`${glb.padEnd(36)} ${String(colours.length).padStart(3)} paints`);
}
const sheet = `# Mesh projections

Generated by \`scripts/mesh-projections.mjs\`; do not edit. Every shipped mesh
projected to its profile from starboard (bow right, waterline drawn) and its
plan from above (bow up, starboard right), as \`models/<stem>-profile.svg\` and
\`models/<stem>-plan.svg\`.

| Mesh | Fidelity | Profile | Plan |
| ---- | -------- | ------- | ---- |
${rows.join('\n')}
`;
writeFileSync(SHEET, await format(sheet, { ...(await resolveConfig(ROOT)), filepath: SHEET }));
console.log(`${glbs.length * 2} drawings, ${Math.round(bytes / 1024)} KiB`);
