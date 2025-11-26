import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  console.log("[overlay] Yjs WebSocket endpoint:", env.VITE_WS_SERVER_URL);

  return {
    root: __dirname,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      fs: {
        strict: false,
      },
    },
    define: {
      '__VITE_WS_SERVER_URL__': JSON.stringify(env.VITE_WS_SERVER_URL)
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks: undefined,
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
        },
      },
      minify: 'esbuild',
      sourcemap: false,
      target: 'es2015',
      // Ensure relative paths work for file:// protocol
      assetsInlineLimit: 0,
    },
    base: './',
  };
});

