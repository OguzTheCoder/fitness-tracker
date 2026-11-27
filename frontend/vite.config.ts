import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function pwaPrecacheManifestPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'pwa-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const urls = new Set<string>(['/', '/index.html', '/manifest.webmanifest']);
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else {
            const rel = '/' + path.relative(outDir, full).split(path.sep).join('/');
            if (rel !== '/sw.js' && !rel.endsWith('.map')) {
              urls.add(rel);
            }
          }
        }
      };
      walk(outDir);

      const content = fs.readFileSync(swPath, 'utf8');
      const injected = content.replace(
        /\/\* __PRECACHE_MANIFEST__ \*\/ \[[\s\S]*?\];/,
        `${JSON.stringify(Array.from(urls), null, 2)};`,
      );
      fs.writeFileSync(swPath, injected, 'utf8');
    },
  };
}

export default defineConfig({
  plugins: [react(), pwaPrecacheManifestPlugin()],
  server: {
    port: 5173,
  },
});
