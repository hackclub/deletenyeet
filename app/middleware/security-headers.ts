import type { Middleware } from 'remix/router'

export const securityHeaders = (): Middleware => async (_, next) => {
  let r = await next()
  let headers = new Headers(r.headers)
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'same-origin')
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers })
}
