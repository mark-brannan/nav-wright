import { defineConfig } from 'vitest/config';

// No @vitejs/plugin-react here: that plugin exists for an app's fast
// refresh. Vitest's esbuild transform reads `jsx: react-jsx` out of
// tsconfig.json, which is all a library's .tsx sources and tests need.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
