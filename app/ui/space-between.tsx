import type { Handle, RemixNode } from 'remix/component'

const SIZES = { xxs: 'xxs', xs: 'xs', s: 's', m: 'm', l: 'l', xl: 'xl', xxl: 'xxl' } as const

export function SpaceBetween(
  handle: Handle<{
    size: keyof typeof SIZES
    direction?: 'vertical' | 'horizontal'
    children: RemixNode
  }>,
) {
  return () => {
    let { size, direction = 'vertical', children } = handle.props
    return (
      <div
        class={direction === 'horizontal' ? 'space-between space-between--horizontal' : 'space-between'}
        style={{ '--space-between-gap': `var(--space-scaled-${SIZES[size]})` }}
      >
        {children}
      </div>
    )
  }
}
