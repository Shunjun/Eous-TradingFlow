import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@eous/tailwind': path.resolve(__dirname, '../../packages/tailwind/src'),
      '@eous/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
      '@eous/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3020',
      '/ws': {
        target: 'http://localhost:3020',
        ws: true,
      },
    },
  },
})
