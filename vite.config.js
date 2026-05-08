import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: env.VITE_APP_BASE_PATH || '/famrut-team-logs/logs/',
    server: {
      port: 5173,
      strictPort: true,
      hmr: {
        port: 5173
      }
    }
  }
})
