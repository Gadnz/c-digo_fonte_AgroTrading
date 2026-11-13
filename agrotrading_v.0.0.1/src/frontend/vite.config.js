import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, encaminha /api e /uploads para o backend (porta 3001).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
