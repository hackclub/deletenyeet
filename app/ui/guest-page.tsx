import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../routes.ts'
import { AppLayout, DOCS } from './app-layout.tsx'
import { Button } from './button.tsx'

export function GuestPage(
  handle: Handle<{ title: string; activeHref: string; children: RemixNode }>,
) {
  return () => {
    let { title, activeHref, children } = handle.props
    return (
      <AppLayout
        title={title}
        homeHref={routes.docs.deletions.href()}
        activeHref={activeHref}
        navigation={[DOCS]}
        utilities={
          <Button variant="link" href={routes.auth.login.href()}>
            Staff sign in
          </Button>
        }
      >
        {children}
      </AppLayout>
    )
  }
}
