import type { Handle, RemixNode } from 'remix/component'

import { Document } from '../actions/document.tsx'
import { routes } from '../routes.ts'
import { AppLayout } from './app-layout.tsx'
import { Button } from './button.tsx'

export interface GuestPageProps {
  title: string
  activeHref: string
  children: RemixNode
}

export function GuestPage(handle: Handle<GuestPageProps>) {
  return () => {
    let { title, activeHref, children } = handle.props
    return (
      <Document title={`${title} · epic data yeeter 9000`}>
        <AppLayout
          title="epic data yeeter 9000"
          homeHref={routes.docs.deletions.href()}
          activeHref={activeHref}
          navigation={[
            {
              title: 'Docs',
              links: [{ text: 'Implementing deletions', href: routes.docs.deletions.href() }],
            },
          ]}
          utilities={
            <Button variant="link" href={routes.auth.login.href()}>
              Staff sign in
            </Button>
          }
        >
          {children}
        </AppLayout>
      </Document>
    )
  }
}
