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
      '@eous/types': path.resolve(__dirname, '../../packages/types/src'),
      '@eous/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5180,
  },
})
