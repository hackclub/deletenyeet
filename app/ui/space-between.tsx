import type { Handle, RemixNode } from 'remix/component'

export function SpaceBetween(
  handle: Handle<{
    size: 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
    direction?: 'vertical' | 'horizontal'
    children: RemixNode
  }>,
) {
  return () => {
    let { size, direction, children } = handle.props
    return (
      <div
        class={`space-between${direction === 'horizontal' ? ' space-between--horizontal' : ''}`}
        style={{ '--space-between-gap': `var(--space-scaled-${size})` }}
      >
        {children}
      </div>
    )
  }
}
