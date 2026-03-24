import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Build-Ausgabe in den Backend-Ordner (Backend serviert die PWA)
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
})
