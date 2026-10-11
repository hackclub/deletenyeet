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

const isHmr = process.env.REMIX_NODE_HMR === '1'
const dev = env.NODE_ENV === 'development'

await (!dev && !env.MIGRATE_ON_START ? assertDatabaseCurrent() : migrateDatabase())
await hackClubAuth.discover()
await startJobs()

const fakeTarget = dev
  ? startFakeTarget({
      port: env.FAKE_TARGET_PORT,
      jwksUrl: new URL('/.well-known/jwks.json', env.APP_ORIGIN).href,
    })
  : null

const pruner = setInterval(
  () => pruneExpiredSessions(db).catch((e) => logError('session pruning', e)),
  60 * 60 * 1000,
).unref()

// tls ends at the reverse proxy so pin request urls to the public origin
// otherwise csrf and cop compare https origins against http urls
const origin = dev ? null : new URL(env.APP_ORIGIN)

const server = http.createServer(
  createRequestListener(router.fetch, {
    trustProxy: isHmr,
    protocol: origin?.protocol,
    host: origin?.host,
    onError(e) {
      logError('unhandled request error', e)
      return new Response('Internal Server Error', { status: 500 })
    },
  }),
)

server.listen(env.PORT, () => {
  if (isHmr) import('remix/node-hmr/runtime').then((h) => h.emitServerReady())
  console.log(`Server listening on http://localhost:${process.env.HMR_PROXY_PORT ?? env.PORT}`)
})

let stopping = false
for (let signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    clearInterval(pruner)
    fakeTarget?.close()
    server.close(() =>
      stopJobs()
        .catch((e) => logError('stopping jobs', e))
        .finally(() => db.close().finally(() => process.exit(0))),
    )
    server.closeAllConnections()
  })
