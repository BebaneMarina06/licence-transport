import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Port dédié à l'API licence transport (évite conflit avec 8000/8001). */
export const API_DEV_PORT = 8010
const API_DEV_TARGET = `http://127.0.0.1:${API_DEV_PORT}`

function apiHealthCheck(): Plugin {
  return {
    name: 'licence-api-health-check',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        setTimeout(async () => {
          try {
            const res = await fetch(`${API_DEV_TARGET}/health`)
            const data = (await res.json()) as { service?: string }
            if (data.service === 'Licence Transport Gabon') {
              console.log(`\n  API licence transport OK → ${API_DEV_TARGET}\n`)
            } else {
              console.warn(
                `\n  ATTENTION : le port ${API_DEV_PORT} répond mais ce n'est pas l'API licence transport.`,
              )
              console.warn(`  Réponse : ${JSON.stringify(data)}\n`)
            }
          } catch {
            console.warn(`\n  API licence transport ABSENTE sur ${API_DEV_TARGET}`)
            console.warn(
              `  Démarrez : cd services/api && .venv\\Scripts\\uvicorn app.main:app --reload --port ${API_DEV_PORT} --host 127.0.0.1\n`,
            )
          }
        }, 500)
      })
    },
  }
}

const proxyConfig = {
  '/api': {
    target: API_DEV_TARGET,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiHealthCheck()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: proxyConfig,
  },
  preview: {
    port: 5173,
    proxy: proxyConfig,
  },
})
