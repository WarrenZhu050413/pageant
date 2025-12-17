import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    hmr: false,
    proxy: {
      '/api': 'http://localhost:8765',
      '/images': 'http://localhost:8765'
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:8766',
      '/images': 'http://localhost:8766'
    }
  }
})
