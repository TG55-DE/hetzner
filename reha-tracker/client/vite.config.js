import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite baut das Frontend direkt in den public-Ordner des Backends
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
});
