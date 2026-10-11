import { Auth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { createMatcher } from 'remix/route-pattern/match'
import type { Middleware } from 'remix/router'
import type { Route } from 'remix/routes'

export function requireStaff(options: { publicRoutes: Route[]; loginHref: string }): Middleware {
  let publicMatchers = options.publicRoutes.map((route) => ({
    method: route.method,
    matcher: createMatcher(route.pattern),
  }))

  return (context, next) => {
    if (context.get(Auth)?.ok) return next()

    let isPublic = publicMatchers.some(
      ({ method, matcher }) =>
        (method === 'ANY' ||
          method === context.method ||
          (method === 'GET' && context.method === 'HEAD')) &&
        matcher.match(context.url) !== null,
    )
    if (isPublic) return next()

    if (context.method === 'GET' || context.method === 'HEAD') {
      let login = new URL(options.loginHref, context.url)
      login.searchParams.set('returnTo', context.url.pathname + context.url.search)
      return redirect(login.pathname + login.search, 303)
    }

    return new Response('Unauthorized', { status: 401 })
  }
}
