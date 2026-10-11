import type { Handle, RemixNode } from 'remix/component'

import { Document } from '../actions/document.tsx'
import { routes } from '../routes.ts'
import { Icon } from './icon.tsx'
import { slot } from './slot.tsx'

export const APP = 'epic data yeeter 9000'

export interface NavSection {
  title?: string
  links: { text: string; href: string }[]
}

export const DOCS: NavSection = {
  title: 'Docs',
  links: [{ text: 'Implementing deletions', href: routes.docs.deletions.href() }],
}

const isActive = (href: string, active: string) =>
  active === href || (href !== '/' && active.startsWith(`${href}/`))

export function AppLayout(
  handle: Handle<{
    title: string
    head?: RemixNode
    homeHref: string
    activeHref: string
    navigation: NavSection[]
    utilities?: RemixNode
    breadcrumbs?: RemixNode
    notifications?: RemixNode
    children: RemixNode
  }>,
) {
  return () => {
    let { title, head, homeHref, activeHref, navigation, utilities, breadcrumbs, notifications } =
      handle.props
    return (
      <Document title={`${title} · ${APP}`} head={head}>
        <div class="app">
          <input
            type="checkbox"
            id="app-nav-toggle"
            class="app__nav-toggle visually-hidden"
            aria-label="Toggle navigation"
          />
          <header class="top-nav" data-context="top-navigation">
            <label for="app-nav-toggle" class="top-nav__menu" title="Toggle navigation">
              <Icon name="menu" />
            </label>
            <a class="top-nav__identity" href={homeHref}>
              {APP}
            </a>
            {slot('top-nav__utilities', utilities)}
          </header>
          <div class="app__body">
            <nav class="side-nav" aria-label="Main">
              {navigation.map((s, i) => (
                <div key={s.title ?? i} class="side-nav__section">
                  {s.title ? <h2 class="side-nav__section-title">{s.title}</h2> : null}
                  <ul>
                    {s.links.map(({ text, href }) => (
                      <li key={href}>
                        <a
                          class="side-nav__link"
                          href={href}
                          aria-current={isActive(href, activeHref) ? 'page' : undefined}
                        >
                          {text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <main class="app__main">
              {slot('app__breadcrumbs', breadcrumbs)}
              <div class="app__notifications">{notifications}</div>
              {handle.props.children}
            </main>
          </div>
        </div>
      </Document>
    )
  }
}
