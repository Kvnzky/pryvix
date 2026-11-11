import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { handleGhlApiRequest } from './src/server/apiMiddleware';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'pryvix-ghl-backend',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          handleGhlApiRequest(req, res, next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          handleGhlApiRequest(req, res, next);
        });
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5188,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
