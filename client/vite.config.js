import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base is set at build time for subpath deploys, e.g.
//   npm run build -- --base=/section_c_tracker/
// Dev proxies /api to the Express server on :3001.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
