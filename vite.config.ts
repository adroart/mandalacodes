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
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
