import { Auth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { createMatcher } from 'remix/route-pattern/match'
import type { Middleware } from 'remix/router'
import type { Route } from 'remix/routes'

export function requireStaff(o: { publicRoutes: Route[]; loginHref: string }): Middleware {
  let open = o.publicRoutes.map((r) => ({ method: r.method, matcher: createMatcher(r.pattern) }))

  return (context, next) => {
    let { method, url } = context
    if (
      context.get(Auth)?.ok ||
      open.some(
        (r) =>
          (r.method === 'ANY' ||
            r.method === method ||
            (r.method === 'GET' && method === 'HEAD')) &&
          r.matcher.match(url) !== null,
      )
    )
      return next()
    if (method !== 'GET' && method !== 'HEAD') return new Response('Unauthorized', { status: 401 })
    let login = new URL(o.loginHref, url)
    login.searchParams.set('returnTo', url.pathname + url.search)
    return redirect(login.pathname + login.search, 303)
  }
}
