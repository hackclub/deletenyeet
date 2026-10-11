import type { Handle, RemixNode } from 'remix/component'

export interface Tab {
  id: string
  label: string
  href: string
}

export function Tabs(handle: Handle<{ tabs: Tab[]; activeId: string; label: string; children: RemixNode }>) {
  return () => {
    let { tabs, activeId, label, children } = handle.props
    return (
      <div class="tabs">
        <nav class="tabs__list" aria-label={label}>
          {tabs.map((tab) => (
            <a
              key={tab.id}
              class="tabs__tab"
              href={tab.href}
              aria-current={tab.id === activeId ? 'page' : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>
        <div class="tabs__panel">{children}</div>
      </div>
    )
  }
}
