import type { Handle } from 'remix/component'

import { Container } from './container.tsx'

export function TableLoading(handle: Handle<{ label: string; href: string }>) {
  return () => (
    <Container>
      <div class="table-loading" role="status" aria-live="polite">
        Loading {handle.props.label}… <a href={handle.props.href}>Reload page</a>
      </div>
    </Container>
  )
}
