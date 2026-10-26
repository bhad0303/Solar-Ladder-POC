import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  server: {
    // Free OSM Map API has no browser CORS — proxy so Find house works without keys
    proxy: {
      '/osm-api': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm-api/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/osm-api': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm-api/, ''),
      },
    },
  },
})
