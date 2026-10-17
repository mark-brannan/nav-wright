// The dev playground: `npm run dev`. Serves playground/ and imports the
// library from ../src, so an edit to a component hot-reloads here. Not part
// of the package — tsconfig.build.json and `files` leave it out. Four pages:
// the playground (index.html), the style gallery (gallery.html), the scenes
// (scenes.html) and the traced real vessels (vessels.html).
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const page = (name: string) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: page('index.html'),
        gallery: page('gallery.html'),
        scenes: page('scenes.html'),
        vessels: page('vessels.html'),
      },
    },
  },
});
