import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {existsSync} from 'fs';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Serve the `api/*.ts` Vercel functions from the dev server.
 *
 * Vite's SPA fallback only answers GET, so a POST to /api/generate-pdf used to
 * 404 in dev — and the client silently fell back to window.print(), which is
 * why "Exporter" looked like it printed instead of downloading. This runs the
 * very same handler locally (puppeteer, a devDependency), so the real export
 * path is what gets exercised during development.
 */
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Only /api/<name> backed by an existing api/<name>.ts. The raw path used
        // to go straight into ssrLoadModule: /api/../<anything> loaded any module
        // of the project on a server listening on 0.0.0.0, and a route with no
        // file answered 500 instead of falling through.
        const name = req.url?.split('?')[0].match(/^\/api\/([a-z0-9-]+)\/?$/)?.[1];
        if (!name || !existsSync(path.resolve(__dirname, 'api', `${name}.ts`))) return next();
        const route = `/api/${name}`;

        try {
          const mod = await server.ssrLoadModule(`.${route}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') return next();

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);

          const proto = 'http';
          const host = req.headers.host ?? 'localhost';
          const request = new Request(`${proto}://${host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          });

          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(`[api-dev-server] ${route} failed: ${err}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error: 'Dev API handler failed'}));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiDevServer()],
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'convex/**/*.test.ts'],
    },
    define: {
      'import.meta.env.VITE_CONVEX_URL': JSON.stringify(env.VITE_CONVEX_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-clerk': ['@clerk/clerk-react'],
            'vendor-convex': ['convex', 'convex/react', 'convex/react-clerk'],
            'vendor-pdf': ['pdfjs-dist'],
            'vendor-ui': ['lucide-react', 'motion', 'clsx', 'tailwind-merge'],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
