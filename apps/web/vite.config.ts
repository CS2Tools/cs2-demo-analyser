import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const HOST_PORT = Number(process.env.CS2_HOST_PORT ?? 5174);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,

    proxy: {
      '/api': { target: `http://127.0.0.1:${HOST_PORT}`, changeOrigin: false },
      '/assets/radar': { target: `http://127.0.0.1:${HOST_PORT}`, changeOrigin: false },
      '/assets/voice': { target: `http://127.0.0.1:${HOST_PORT}`, changeOrigin: false },
      '/assets/icon': { target: `http://127.0.0.1:${HOST_PORT}`, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
