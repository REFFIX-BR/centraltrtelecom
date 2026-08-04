import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4050',
      '/webhook': 'http://localhost:4050',
      '/uploads': 'http://localhost:4050',
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:4050',
      '/webhook': 'http://localhost:4050',
      '/uploads': 'http://localhost:4050',
    },
  },
});
