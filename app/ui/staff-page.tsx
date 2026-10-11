import type { Handle, RemixNode } from 'remix/component'

import { Document } from '../actions/document.tsx'
import type { Staff } from '../auth/staff.ts'
import { env } from '../env.ts'
import { routes } from '../routes.ts'
import { AppLayout, type SideNavigationSection } from './app-layout.tsx'
import { Breadcrumbs, type BreadcrumbItem } from './breadcrumbs.tsx'
import { Button } from './button.tsx'
import { Flashbar, type FlashItem } from './flashbar.tsx'

export interface StaffPageProps {
  title: string
  staff: Staff
  csrfToken: string
  activeHref: string
  breadcrumbs?: BreadcrumbItem[]
  flashes?: FlashItem[]
  refreshSeconds?: number
  children: RemixNode
}

function navigation(): SideNavigationSection[] {
  let sections: SideNavigationSection[] = [
    {
      links: [
        { text: 'Requests', href: routes.requests.index.href() },
        { text: 'Targets', href: routes.targets.index.href() },
      ],
    },
  ]
  if (env.NODE_ENV === 'development') {
    sections.push({
      title: 'Development',
      links: [{ text: 'Components', href: routes.dev.components.href() }],
    })
  }
  return sections
}

export function StaffPage(handle: Handle<StaffPageProps>) {
  return () => {
    let { title, staff, csrfToken, activeHref, breadcrumbs, flashes, refreshSeconds, children } =
      handle.props
    return (
      <Document
        title={`${title} · Privacy request hub`}
        head={
          refreshSeconds ? (
            <meta http-equiv="refresh" content={String(refreshSeconds)} />
          ) : undefined
        }
      >
        <AppLayout
          title="Privacy request hub"
          homeHref={routes.home.href()}
          activeHref={activeHref}
          navigation={navigation()}
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
          notifications={flashes && flashes.length > 0 ? <Flashbar items={flashes} /> : undefined}
        >
          {children}
        </AppLayout>
      </Document>
    )
  }
}
