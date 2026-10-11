import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

let num = (v: string | undefined, fallback: number) => (v ? Number.parseInt(v, 10) : fallback)
const proxyPort = num(process.env.PORT, 44100)
const eventPort = num(process.env.HMR_PORT, proxyPort + 1)
const appPort = num(process.env.APP_PORT, eventPort + 1)

const runner = run('server.ts', {
  env: { ...process.env, PORT: String(appPort), HMR_PROXY_PORT: String(proxyPort) },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
  browserHmrChannel: { port: eventPort },
})

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(
      runner,
      createFetchProxy(`http://127.0.0.1:${appPort}`, { xForwardedHeaders: true }),
    ),
  ),
)
server.listen(proxyPort, '127.0.0.1')

let stopping = false
for (let signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    server.close(() => runner.close().finally(() => process.exit(0)))
    server.closeAllConnections()
  })
