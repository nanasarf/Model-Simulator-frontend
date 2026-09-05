import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://localhost:5070';
  return {
    plugins: [react()],
    server: { proxy: { '/api': { target }, '/hubs': { target, ws: true } } },
    test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], restoreMocks: true },
  };
});
