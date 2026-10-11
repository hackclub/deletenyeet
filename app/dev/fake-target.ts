import * as http from 'node:http'

import { createRemoteJWKSet } from 'jose'

import { TokenError, verifyTargetToken } from '../signing/tokens.ts'

export const FAKE_TARGET_MODES = ['ok', 'flaky', 'down', 'reject', 'missing'] as const
export const FAKE_TARGET_AUDIENCE = 'fake-target'

// stands in for a program in development. the first path segment picks a behaviour:
// ok, flaky (503 until the third attempt), down (always 500), reject (401), missing (found false)
export function startFakeTarget(o: { port: number; jwksUrl: string }) {
  let keys = createRemoteJWKSet(new URL(o.jwksUrl), { cacheMaxAge: 30_000 })

  return http
    .createServer(async (req, res) => {
      let send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      let [, mode, action] = /^\/([a-z]+)\/api\/privacy\/(delete|export)$/.exec(req.url ?? '') ?? []
      if (req.method !== 'POST' || !FAKE_TARGET_MODES.some((m) => m === mode))
        return send(404, { error: 'not_found' })

      let token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
      if (!token) return send(401, { error: 'missing_token' })

      let claims
      try {
        claims = await verifyTargetToken(token, keys, { audience: FAKE_TARGET_AUDIENCE })
      } catch (error) {
        return send(401, { error: error instanceof TokenError ? error.code : 'invalid_token' })
      }
      if (claims.action !== action) return send(400, { error: 'action_mismatch' })
      if (mode === 'down') return send(500, { error: 'down' })
      if (mode === 'reject') return send(401, { error: 'rejected' })
      if (mode === 'flaky' && Number(claims.jti.split('-').at(-2)) % 3 !== 0)
        return send(503, { error: 'flaky' })

      let found = mode !== 'missing'
      send(200, {
        request_id: claims.request_id,
        found,
        dry_run: claims.dry_run,
        deleted: found ? { accounts: 1, projects: 3, comments: 12 } : {},
        retained: found
          ? [{ type: 'orders', count: 2, reason: 'kept 7 years for tax records' }]
          : [],
      })
    })
    .listen(o.port, '127.0.0.1')
}
