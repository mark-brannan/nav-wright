// `npm run render` (#128): every scene in playground/namedScenes.json, opened
// in headless Chromium with WebGL against the built playground, one PNG per
// scene in renders/ plus renders/contact-sheet.png. renders/ is gitignored.
//   node scripts/render-scenes.mjs [distDir]   distDir defaults to playground-dist
// The npm script builds the playground first. A scene list URL starts with the
// list's `base`; the rest (query string, or a page and its query) is opened
// against a local static server over distDir, so the render shows this
// checkout, not the deployed site.

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const dist = resolve(process.argv[2] ?? 'playground-dist');
const outDir = 'renders';
const list = JSON.parse(readFileSync('playground/namedScenes.json', 'utf8'));
const VIEWPORT = { width: 1280, height: 900 };
const SETTLE_MS = 800; // after load: the lazy 3D model mounts and draws
// WebGL on SwiftShader, not the host GPU: the same software renderer locally
// and on a CI runner, and present where no GPU is. Chromium dropped the
// automatic SwiftShader fallback for WebGL, hence the unsafe flag.
const WEBGL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = normalize(join(root, path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function localUrl(scene, origin) {
  if (!scene.url.startsWith(list.base)) {
    throw new Error(`${scene.name}: url does not start with the list's base ${list.base}`);
  }
  return `${origin}/${scene.url.slice(list.base.length)}`;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const started = performance.now();
readFileSync(join(dist, 'index.html')); // fail early, and plainly, on an unbuilt playground
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const server = await serve(dist);
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: WEBGL_ARGS });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});
const page = await context.newPage();

const gl = await page.evaluate(() => {
  const c =
    document.createElement('canvas').getContext('webgl2') ??
    document.createElement('canvas').getContext('webgl');
  if (!c) return null;
  const info = c.getExtension('WEBGL_debug_renderer_info');
  return info ? c.getParameter(info.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);
});
if (!gl) {
  console.error('render: no WebGL context in headless Chromium; the 3D scenes would render blank');
  process.exit(1);
}
console.log(`render: WebGL on ${gl}`);

const shots = [];
let failed = 0;
for (const scene of list.scenes) {
  const errors = [];
  const onError = (e) => errors.push(e.message);
  page.on('pageerror', onError);
  await page.goto(localUrl(scene, origin), { waitUntil: 'networkidle' });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  await page.waitForTimeout(SETTLE_MS);
  page.off('pageerror', onError);
  const png = await page.screenshot();
  writeFileSync(join(outDir, `${scene.name}.png`), png);
  shots.push({ scene, png });
  if (errors.length) {
    failed++;
    console.error(`render: ${scene.name}: page error: ${errors.join('; ')}`);
  } else {
    console.log(`render: ${scene.name}.png`);
  }
}

// The contact sheet: every shot at a third of its width, named and described,
// laid out by the browser so no image library is needed.
const cells = shots
  .map(
    ({ scene, png }) =>
      `<figure><img src="data:image/png;base64,${png.toString('base64')}">` +
      `<figcaption><b>${escape(scene.name)}</b> ${escape(scene.description)}</figcaption></figure>`,
  )
  .join('');
await page.setViewportSize({ width: 1320, height: 400 });
await page.setContent(
  `<!doctype html><style>
    body { margin: 16px; font: 13px/1.35 system-ui, sans-serif; background: #fff; color: #111; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    figure { margin: 0; } img { width: 100%; display: block; border: 1px solid #ccc; }
    figcaption { margin-top: 4px; } b { font-family: ui-monospace, monospace; }
  </style><main>${cells}</main>`,
  { waitUntil: 'load' },
);
writeFileSync(join(outDir, 'contact-sheet.png'), await page.screenshot({ fullPage: true }));

await browser.close();
server.close();
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(`render: ${shots.length} scenes and contact-sheet.png in ${outDir}/, ${seconds} s`);
process.exit(failed ? 1 : 0);
