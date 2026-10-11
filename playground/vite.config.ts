// The dev playground: `npm run dev`. Serves playground/ and imports the
// library from ../src, so an edit to a component hot-reloads here. Not part
// of the package — tsconfig.build.json and `files` leave it out.
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
});
