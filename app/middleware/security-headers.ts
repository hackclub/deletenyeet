import type { Middleware } from 'remix/router'

export function securityHeaders(): Middleware {
  return async (_context, next) => {
    let response = await next()
    let headers = new Headers(response.headers)
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'same-origin')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
