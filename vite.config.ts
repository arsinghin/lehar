import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // The CSP forbids inline scripts, so skip Vite's inline modulepreload polyfill.
    modulePreload: { polyfill: false },
    sourcemap: false,
    cssCodeSplit: true,
  },
  server: {
    // `npm run dev` serves only the SPA; use `vercel dev` to run /api functions locally.
    port: 5173,
  },
});
