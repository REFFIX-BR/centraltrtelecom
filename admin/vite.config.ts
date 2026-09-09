import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Em produção o painel vive em https://trtelecom.net/central-admin-app */
const PANEL_BASE = '/central-admin-app/';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? PANEL_BASE : '/',
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
}));
