import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { DeletionsDocsPage } from './pages.tsx'

export default createController(routes.docs, {
  actions: {
    deletions(context) {
      return context.render(
        <DeletionsDocsPage
          staff={context.auth.ok ? context.auth.identity : null}
          csrfToken={getCsrfToken(context)}
        />,
      )
    },
  },
})
