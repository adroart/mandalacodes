import { defineConfig, loadEnv } from 'vite';
import { execFileSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { createArCreateMiddleware } from './tools/oracle-ar-create-bridge.mjs';
import { createArCreateWriting } from './tools/oracle-ar-create-writing.mjs';
const arCreate = () => { const writing = createArCreateWriting(); return createArCreateMiddleware({ writingHandler: body => writing.handle(body), writingCapabilities: () => writing.capabilities() }); };
const local = (file: string) => path.resolve(__dirname, file);
const gitHead = () => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
// The native build number (CURRENT_PROJECT_VERSION) read from the Xcode project text; no Xcode needed.
const nativeBuild = () => { try { return /CURRENT_PROJECT_VERSION = (\d+);/.exec(fs.readFileSync(local('mobile/ios/App/App.xcodeproj/project.pbxproj'), 'utf8'))?.[1] ?? ''; } catch { return ''; } };
const commit = gitHead();
const builtAt = new Date().toISOString();
const accounts = loadEnv('production', __dirname, 'VITE_').VITE_ORACLE_NATIVE_ACCOUNTS === 'true';
export default defineConfig({
  plugins: [react(), { name: 'oracle-ar-create', configureServer(server) { server.middlewares.use(arCreate()); }, configurePreviewServer(server) { server.middlewares.use(arCreate()); } }, {
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
  }, {
    // Read by mobile/scripts/check-oracle-build.mjs before any device build.
    name: 'oracle-build-manifest',
    closeBundle() {
      if (fs.existsSync(local('dist-oracle'))) fs.writeFileSync(local('dist-oracle/oracle-build.json'), JSON.stringify({ accounts, commit, builtAt }, null, 2) + '\n');
    },
  }],
  define: {
    'import.meta.env.VITE_ORACLE_APP': JSON.stringify('true'),
    'import.meta.env.VITE_ORACLE_BUILD_COMMIT': JSON.stringify(commit.slice(0, 7)),
    'import.meta.env.VITE_ORACLE_BUILD_TIME': JSON.stringify(builtAt),
    'import.meta.env.VITE_ORACLE_BUILD_NUMBER': JSON.stringify(nativeBuild()),
  },
  publicDir: local('.oracle-public'),
  resolve: { alias: [
    { find: /^.*\/OracleShareSheet$/, replacement: local('src/mobile/OracleShareSheet.tsx') },
    { find: /^.*\/NavigationCore$/, replacement: local('src/mobile/OracleNavigation.tsx') },
    { find: /^.*\/launchFlags$/, replacement: local('src/mobile/flags.ts') },
    { find: /^.*\/utils\/media$/, replacement: local('src/mobile/media.ts') },
    { find: './media', replacement: local('src/mobile/media.ts') },
    { find: '@', replacement: local('.') },
  ] },
  build: { outDir: 'dist-oracle', target: 'es2022', sourcemap: false, rollupOptions: { input: local('oracle-app.html') } },
});
