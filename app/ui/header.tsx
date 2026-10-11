import type { Handle, RemixNode } from 'remix/component'

import { slot } from './slot.tsx'

export function Header(
  handle: Handle<{
    variant?: 'h1' | 'h2' | 'h3'
    children: RemixNode
    counter?: string
    description?: RemixNode
    actions?: RemixNode
  }>,
) {
  return () => {
    let { variant: Tag = 'h2', children, counter, description, actions } = handle.props
    return (
      <div class={`header header--${Tag}`}>
        <div class="header__text">
          <Tag class="header__title">
            {children}
            {counter ? <span class="header__counter">{counter}</span> : null}
          </Tag>
          {description ? <p class="header__description">{description}</p> : null}
        </div>
        {slot('header__actions', actions)}
      </div>
    )
  }
}
