import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // ADD THIS LINE to set the base path for GitHub Pages project sites
  base: '/Botai/', 
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    exclude: ['manifold-3d']
  },
  worker: {
    format: 'es'
  }
});