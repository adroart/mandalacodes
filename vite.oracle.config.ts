import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
const local = (file: string) => path.resolve(__dirname, file);
export default defineConfig({
  plugins: [react(), {
    name: 'oracle-native-entry',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.headers.accept?.includes('text/html') && !request.url?.startsWith('/@')) request.url = '/oracle-app.html';
        next();
      });
    },
    closeBundle() {
      const file = local('dist-oracle/oracle-app.html');
      if (fs.existsSync(file)) fs.renameSync(file, local('dist-oracle/index.html'));
    },
  }],
  define: { 'import.meta.env.VITE_ORACLE_APP': JSON.stringify('true') },
  publicDir: local('.oracle-public'),
  resolve: { alias: [
    // Keep native drawing independent of the website's newer dialog and styles.
    { find: /^.*\/OracleDrawDialog$/, replacement: local('src/mobile/OracleDrawDialog.tsx') },
    { find: /^.*\/OracleShareSheet$/, replacement: local('src/mobile/OracleShareSheet.tsx') },
    { find: /^.*\/NavigationCore$/, replacement: local('src/mobile/OracleNavigation.tsx') },
    { find: /^.*\/launchFlags$/, replacement: local('src/mobile/flags.ts') },
    { find: /^.*\/utils\/media$/, replacement: local('src/mobile/media.ts') },
    { find: './media', replacement: local('src/mobile/media.ts') },
    { find: '@', replacement: local('.') },
  ] },
  build: { outDir: 'dist-oracle', target: 'es2022', sourcemap: false, rollupOptions: { input: local('oracle-app.html') } },
});
