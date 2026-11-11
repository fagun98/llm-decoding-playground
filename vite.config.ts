import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/llm-decoding-playground/',
  optimizeDeps: {
    exclude: ['@xenova/transformers']
  },
  build: {
    chunkSizeWarningLimit: 1200
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
