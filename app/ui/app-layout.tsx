import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'

export interface SideNavigationLink {
  text: string
  href: string
}

export interface SideNavigationSection {
  title?: string
  links: SideNavigationLink[]
}

export interface AppLayoutProps {
  title: string
  homeHref: string
  activeHref: string
  navigation: SideNavigationSection[]
  utilities?: RemixNode
  breadcrumbs?: RemixNode
  notifications?: RemixNode
  children: RemixNode
}

export function AppLayout(handle: Handle<AppLayoutProps>) {
  return () => {
    let {
      title,
      homeHref,
      activeHref,
      navigation,
      utilities,
      breadcrumbs,
      notifications,
      children,
    } = handle.props
    return (
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
            {title}
          </a>
          {utilities ? <div class="top-nav__utilities">{utilities}</div> : null}
        </header>
        <div class="app__body">
          <nav class="side-nav" aria-label="Main">
            {navigation.map((section, index) => (
              <div key={section.title ?? index} class="side-nav__section">
                {section.title ? <h2 class="side-nav__section-title">{section.title}</h2> : null}
                <ul>
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <a
                        class="side-nav__link"
                        href={link.href}
                        aria-current={isActive(link.href, activeHref) ? 'page' : undefined}
                      >
                        {link.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <main class="app__main">
            {breadcrumbs ? <div class="app__breadcrumbs">{breadcrumbs}</div> : null}
            <div class="app__notifications">{notifications}</div>
            {children}
          </main>
        </div>
      </div>
    )
  }
}

function isActive(href: string, activeHref: string) {
  return href === '/'
    ? activeHref === '/'
    : activeHref === href || activeHref.startsWith(`${href}/`)
}
