import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths — needed so the built app also works when Electron
  // loads index.html via file:// (an absolute '/assets/...' path resolves
  // against the filesystem root under file://, not the dist folder, which
  // is a blank-screen bug waiting to happen). Relative paths resolve
  // correctly under normal HTTP serving too, so this doesn't affect the web
  // deployment (Docker/dev server) at all.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
