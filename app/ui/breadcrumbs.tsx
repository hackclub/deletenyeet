import type { Handle } from 'remix/component'

export interface BreadcrumbItem {
  text: string
  href: string
}

export function Breadcrumbs(handle: Handle<{ items: BreadcrumbItem[] }>) {
  return () => {
    let { items } = handle.props
    return (
      <nav aria-label="Breadcrumbs">
        <ol class="breadcrumbs">
          {items.map(({ text, href }, i) => (
            <li key={href}>
              {i === items.length - 1 ? (
                <span aria-current="page">{text}</span>
              ) : (
                <a href={href}>{text}</a>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }
}
