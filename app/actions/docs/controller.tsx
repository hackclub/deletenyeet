import { getCsrfToken } from 'remix/middleware/csrf'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { DeletionsDocsPage } from './pages.tsx'
import { deletionsMarkdown } from './markdown.ts'

export default createController(routes.docs, {
  actions: {
    deletions(context) {
      if (context.url.searchParams.has('agents')) {
        return new Response(deletionsMarkdown, {
          headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        })
      }
      return context.render(
        <DeletionsDocsPage
          staff={context.auth.ok ? context.auth.identity : null}
          csrfToken={getCsrfToken(context)}
        />,
      )
    },
  },
})
