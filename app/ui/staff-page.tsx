import type { Handle, RemixNode } from 'remix/component'

import type { Staff } from '../auth/staff.ts'
import { env } from '../env.ts'
import { routes } from '../routes.ts'
import { AppLayout, DOCS } from './app-layout.tsx'
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs.tsx'
import { Button } from './button.tsx'
import { Flashbar, type FlashItem } from './flashbar.tsx'

export function StaffPage(
  handle: Handle<{
    title: string
    staff: Staff
    csrfToken: string
    activeHref: string
    breadcrumbs?: BreadcrumbItem[]
    flashes?: FlashItem[]
    refreshSeconds?: number
    children: RemixNode
  }>,
) {
  return () => {
    let { title, staff, csrfToken, activeHref, breadcrumbs, flashes, refreshSeconds, children } =
      handle.props
    return (
      <AppLayout
        title={title}
        head={
          refreshSeconds ? (
            <meta http-equiv="refresh" content={String(refreshSeconds)} />
          ) : undefined
        }
        homeHref={routes.home.href()}
        activeHref={activeHref}
        navigation={[
          {
            links: [
              { text: 'Requests', href: routes.requests.index.href() },
              { text: 'Targets', href: routes.targets.index.href() },
            ],
          },
          DOCS,
          ...(env.NODE_ENV === 'development'
            ? [
                {
                  title: 'Development',
                  links: [{ text: 'Components', href: routes.dev.components.href() }],
                },
              ]
            : []),
        ]}
        utilities={
          <>
            <span class="top-nav__user">{staff.name ?? staff.sub}</span>
            <form method="post" action={routes.auth.logout.href()}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <Button type="submit" variant="link">
                Sign out
              </Button>
            </form>
          </>
        }
        breadcrumbs={breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : undefined}
        notifications={flashes?.length ? <Flashbar items={flashes} /> : undefined}
      >
        {children}
      </AppLayout>
    )
  }
}
