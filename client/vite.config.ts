import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, '../shared') },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001', '/socket.io': 'http://localhost:3001', '/uploads': 'http://localhost:3001' }
  }
})
