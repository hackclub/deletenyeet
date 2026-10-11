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
          {items.map((item, index) => (
            <li key={item.href}>
              {index === items.length - 1 ? (
                <span aria-current="page">{item.text}</span>
              ) : (
                <a href={item.href}>{item.text}</a>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }
}
