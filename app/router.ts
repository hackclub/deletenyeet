import { auth } from 'remix/middleware/auth'
import { cop } from 'remix/middleware/cop'
import { csrf } from 'remix/middleware/csrf'
import { formData } from 'remix/middleware/form-data'
import { logger } from 'remix/middleware/logger'
import { render } from 'remix/middleware/render'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type RouterContext } from 'remix/router'

import authController from './actions/auth/controller.tsx'
import controller from './actions/controller.tsx'
import devController from './actions/dev/controller.tsx'
import docsController from './actions/docs/controller.tsx'
import requestsController from './actions/requests/controller.tsx'
import targetsController from './actions/targets/controller.tsx'
import { assets } from './assets.ts'
import { env } from './env.ts'
import { sessionCookie, sessionStorage, staffSessionScheme } from './auth/staff.ts'
import { loadDatabase } from './middleware/database.ts'
import { requireStaff } from './middleware/require-staff.ts'
import { securityHeaders } from './middleware/security-headers.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [
    logger({ format: '%method %pathname %status %duration ms' }),
    staticFiles('./public', { index: false }),
    securityHeaders(),
    loadDatabase(),
    cop(),
    session(sessionCookie, sessionStorage),
    formData({ maxFiles: 0, maxTotalSize: 64 * 1024 }),
    csrf({
      allowMissingOrigin: false,
      onError: () =>
        new Response('This form has expired. Go back, reload the page, and try again.', {
          status: 403,
        }),
    }),
    auth({ schemes: [staffSessionScheme] }),
    requireStaff({
      loginHref: routes.auth.login.href(),
      publicRoutes: [
        routes.assets,
        routes.health,
        routes.jwks,
        routes.docs.deletions,
        routes.auth.login,
        routes.auth.startLogin,
        routes.auth.callback,
      ],
    }),
    render({ assets }),
  ],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, controller)
router.map(routes.auth, authController)
router.map(routes.requests, requestsController)
router.map(routes.targets, targetsController)
router.map(routes.docs, docsController)
if (env.NODE_ENV === 'development') router.map(routes.dev, devController)
