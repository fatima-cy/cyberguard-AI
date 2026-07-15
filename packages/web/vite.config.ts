import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Force esbuild to pre-bundle the workspace shared package, converting its
  // CommonJS output to browser-compatible ESM. Without this, Vite's dev
  // server serves the raw CJS file directly to the browser (which has no
  // `exports`/`require` globals), causing "exports is not defined" — this
  // was never hit before because every prior @cyberguard/shared import in
  // the web app was `import type` only (erased at compile time, so the
  // actual JS file was never loaded at runtime until now).
  optimizeDeps: {
    include: ['@cyberguard/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
