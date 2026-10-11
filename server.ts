import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { pruneExpiredSessions } from './app/auth/session-storage.ts'
import { hackClubAuth } from './app/auth/staff.ts'
import { assertDatabaseCurrent, db, migrateDatabase } from './app/db.ts'
import { startFakeTarget } from './app/dev/fake-target.ts'
import { env } from './app/env.ts'
import { startJobs, stopJobs } from './app/jobs/workers.ts'
import { logError } from './app/log.ts'
import { router } from './app/router.ts'

const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

if (env.NODE_ENV === 'production' && !env.MIGRATE_ON_START) {
  await assertDatabaseCurrent()
} else {
  await migrateDatabase()
}

await hackClubAuth.discover()
await startJobs()

const fakeTarget =
  env.NODE_ENV === 'development'
    ? startFakeTarget({
        port: env.FAKE_TARGET_PORT,
        jwksUrl: new URL('/.well-known/jwks.json', env.APP_ORIGIN).href,
      })
    : null

const sessionPruner = setInterval(
  () => {
    pruneExpiredSessions(db).catch((error) => logError('session pruning', error))
  },
  60 * 60 * 1000,
)
sessionPruner.unref()

// tls ends at the reverse proxy so pin request urls to the public origin
// otherwise csrf and cop compare https origins against http urls
const publicOrigin = env.NODE_ENV === 'production' ? new URL(env.APP_ORIGIN) : null

const server = http.createServer(
  createRequestListener(router.fetch, {
    trustProxy: isHmr,
    protocol: publicOrigin?.protocol,
    host: publicOrigin?.host,
    onError(error) {
      logError('unhandled request error', error)
      return new Response('Internal Server Error', { status: 500 })
    },
  }),
)

server.listen(env.PORT, () => {
  if (isHmr) {
    import('remix/node-hmr/runtime').then((nodeHmr) => nodeHmr.emitServerReady())
  }

  console.log(`Server listening on http://localhost:${hmrProxyPort ?? env.PORT}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  clearInterval(sessionPruner)
  fakeTarget?.close()
  server.close(() => {
    stopJobs()
      .catch((error) => logError('stopping jobs', error))
      .finally(() => db.close().finally(() => process.exit(0)))
  })
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
