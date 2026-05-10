import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBase = (env.VITE_APP_BASE_PATH || '/esds-worklogs/').replace(/\/?$/, '')
  const apiPrefix = `${appBase}/jira-api`

  return {
    plugins: [react()],
    base: env.VITE_APP_BASE_PATH || '/esds-worklogs/',
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173
      },
      // Local SSO: browser hits the SPA origin; /jira-api/* is forwarded to PHP
      // so session cookies are set for localhost (see jira-api/.env.example).
      proxy: {
        [apiPrefix]: {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(apiPrefix, '') || '/',
        },
      },
    }
  }
})
