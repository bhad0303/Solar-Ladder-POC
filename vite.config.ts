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
    // PVGIS also blocks browser CORS — same-origin proxy (not a public CORS proxy)
    proxy: {
      '/osm-api': {
        target: 'https://api.openstreetmap.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/osm-api/, ''),
      },
      '/pvgis-api': {
        target: 'https://re.jrc.ec.europa.eu',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/pvgis-api/, '/api/v5_3'),
        // Browser Origin/Referer from localhost often trip JRC WAF ("URL was rejected")
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            proxyReq.setHeader(
              'User-Agent',
              'Mozilla/5.0 (compatible; SolarPreviewPoC/1.0)',
            )
            proxyReq.setHeader('Accept', 'application/json')
          })
        },
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
      '/pvgis-api': {
        target: 'https://re.jrc.ec.europa.eu',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/pvgis-api/, '/api/v5_3'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            proxyReq.setHeader(
              'User-Agent',
              'Mozilla/5.0 (compatible; SolarPreviewPoC/1.0)',
            )
            proxyReq.setHeader('Accept', 'application/json')
          })
        },
      },
    },
  },
})

