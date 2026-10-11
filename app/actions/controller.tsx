import { sql } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { logError } from '../log.ts'
import { routes } from '../routes.ts'
import { keyring } from '../signing/keys.ts'
import { notFound } from './shared.tsx'

let fresh = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Cache-Control': 'no-store' } })

export default createController(routes, {
  actions: {
    assets: async (c) => (await assets.fetch(c.request)) ?? notFound(),
    async health(c) {
      try {
        await c.db.exec(sql`select 1`)
        return fresh('ok')
      } catch (e) {
        logError('health check', e)
        return fresh('database unavailable', 503)
      }
    },
    jwks: () =>
      Response.json(
        { keys: keyring.publicKeys },
        { headers: { 'Cache-Control': 'public, max-age=300' } },
      ),
    home: () => redirect(routes.requests.index.href(), 303),
  },
})
