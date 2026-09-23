import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  root: fromRoot('./public'),
  base: './',
  publicDir: false,
  plugins: [tailwindcss()],
  resolve: {
    alias: [{ find: /^\/src\//, replacement: `${fromRoot('./src')}/` }],
  },
  build: {
    outDir: fromRoot('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
