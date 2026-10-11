import type { Handle, RemixNode } from 'remix/component'

export function Tabs(
  handle: Handle<{
    tabs: { id: string; label: string; href: string }[]
    activeId: string
    label: string
    children: RemixNode
  }>,
) {
  return () => {
    let { tabs, activeId, label, children } = handle.props
    return (
      <div class="tabs">
        <nav class="tabs__list" aria-label={label}>
          {tabs.map((t) => (
            <a
              key={t.id}
              class="tabs__tab"
              href={t.href}
              aria-current={t.id === activeId ? 'page' : undefined}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <div class="tabs__panel">{children}</div>
      </div>
    )
  }
}
