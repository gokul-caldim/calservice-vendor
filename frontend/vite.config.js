import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_WORKFORCE_API_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    server: {
      port: 5176,
      host: true,
      hmr: {
        clientPort: 5176,
      },
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
        '/media': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

