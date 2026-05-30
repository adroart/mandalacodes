import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/',
    },
  },
  server: {
    port: 2222,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
