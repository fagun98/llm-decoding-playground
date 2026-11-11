import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/llm-decoding-playground/',
  optimizeDeps: {
    exclude: ['@xenova/transformers']
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
