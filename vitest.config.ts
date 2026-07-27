import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    // A single global jsdom environment (rather than switching per file via
    // environmentMatchGlobs) - mixing environments within one run left @testing-library/user-event
    // with a stale `globalThis.document` captured from whichever environment its module graph
    // first loaded under, breaking it for every .test.tsx file. jsdom is a superset of plain 'node'
    // globals, so the existing dependency-free .test.ts files are unaffected.
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
});
