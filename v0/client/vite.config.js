import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is deployed under this subpath on the VPS. Kept here (not only as a
// --build flag) so the dev server and production build agree, and so
// import.meta.env.BASE_URL — which api.js uses to prefix every request — is
// correct in both. Override at build time with `npm run build -- --base=/other/`
// if the deploy path ever changes.
const base = '/ai_impact_builder/';
const baseNoSlash = base.replace(/\/$/, '');

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      // In dev, requests go to `${base}api/...`. Mirror production (where nginx
      // strips the subpath before proxying) by rewriting it back to /api/... for
      // the Express server on :3001.
      [`${base}api`]: {
        target: 'http://localhost:3001',
        rewrite: (p) => p.replace(baseNoSlash, ''),
      },
    },
  },
});
