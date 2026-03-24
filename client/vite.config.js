import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, createLogger } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function createApiProxy(apiPort) {
  const target = `http://127.0.0.1:${apiPort}`
  return {
    target,
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api/, ''),
    configure: (proxy) => {
      proxy.on('error', (err) => {
        console.error(
          `\n[vite proxy] API → ${target} failed. Start Smart Attendance backend on port ${apiPort}:\n` +
            `  cd ..   # project root\n` +
            `  python -m uvicorn app.main:app --reload --port ${apiPort}\n`,
          err.message,
        )
      })
      proxy.on('proxyReq', (proxyReq, req) => {
        const raw = req.socket?.remoteAddress || ''
        const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw
        if (ip && ip !== '::1') {
          proxyReq.setHeader('X-Forwarded-For', ip)
        }
      })
    },
  }
}

// Hide duplicate "Network: http://172.x.x.x" lines (WSL/Docker/Hyper-V virtual NICs).
const logger = createLogger()
const origInfo = logger.info.bind(logger)
logger.info = (msg, options) => {
  if (typeof msg === 'string') {
    const lines = msg.split('\n').filter((line) => {
      if (!line.includes('Network:')) return true
      if (/https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./.test(line)) return false
      return true
    })
    const next = lines.join('\n')
    if (!next.trim()) return
    msg = next
  }
  origInfo(msg, options)
}

function campusNetworkHintPlugin(hintHost) {
  return {
    name: 'campus-network-hint',
    configureServer(server) {
      if (!hintHost || hintHost === '0' || hintHost === 'false') return
      let printed = false
      const log = () => {
        if (printed) return true
        const httpServer = server.httpServer
        if (!httpServer) return false
        const addr = httpServer.address()
        if (!addr || typeof addr !== 'object' || addr.port == null) return false
        printed = true
        server.config.logger.info(
          `  ➜  Network (10.4.214 campus): http://${hintHost}:${addr.port}/`,
        )
        return true
      }
      return () => {
        server.httpServer?.once('listening', log)
        let tries = 0
        const id = setInterval(() => {
          if (log() || ++tries > 80) clearInterval(id)
        }, 25)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const hintHost = (env.VITE_NETWORK_HINT_HOST ?? '10.4.214.75').trim()
  // Default 8001 in .env.development avoids another app (e.g. LMS) on 8000 stealing requests
  const apiPort = env.VITE_API_PORT || '8001'
  const apiProxy = createApiProxy(apiPort)

  return {
    customLogger: logger,
    plugins: [react(), campusNetworkHintPlugin(hintHost)],
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      proxy: { '/api': apiProxy },
    },
    preview: {
      host: true,
      proxy: { '/api': apiProxy },
    },
  }
})
