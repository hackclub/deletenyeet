import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { ComponentsPage } from './components-page.tsx'

export default createController(routes.dev, {
  actions: {
    components(context) {
      if (!context.auth.ok) return new Response('Unauthorized', { status: 401 })
      return context.render(
        <ComponentsPage staff={context.auth.identity} csrfToken={getCsrfToken(context)} url={context.url} />,
      )
    },
  },
})
