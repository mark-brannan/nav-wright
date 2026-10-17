// The dev playground: `npm run dev`. Serves playground/ and imports the
// library from ../src, so an edit to a component hot-reloads here. Not part
// of the package — tsconfig.build.json and `files` leave it out. Two pages:
// the playground (index.html) and the style gallery (gallery.html).
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
      },
    },
  },
});
