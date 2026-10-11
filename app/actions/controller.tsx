import { sql } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { logError } from '../log.ts'
import { routes } from '../routes.ts'
import { keyring } from '../signing/keys.ts'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },
    async health(context) {
      try {
        await context.db.exec(sql`select 1`)
        return new Response('ok', { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        logError('health check', error)
        return new Response('database unavailable', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    },
    jwks() {
      return Response.json(
        { keys: keyring.publicKeys },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      )
    },
    home() {
      return redirect(routes.requests.index.href(), 303)
    },
  },
})
