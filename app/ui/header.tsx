import type { Handle, RemixNode } from 'remix/component'

export interface HeaderProps {
  variant?: 'h1' | 'h2' | 'h3'
  children: RemixNode
  counter?: string
  description?: RemixNode
  actions?: RemixNode
}

export function Header(handle: Handle<HeaderProps>) {
  return () => {
    let { variant = 'h2', children, counter, description, actions } = handle.props
    let Tag = variant
    return (
      <div class={`header header--${variant}`}>
        <div class="header__text">
          <Tag class="header__title">
            {children}
            {counter ? <span class="header__counter">{counter}</span> : null}
          </Tag>
          {description ? <p class="header__description">{description}</p> : null}
        </div>
        {actions ? <div class="header__actions">{actions}</div> : null}
      </div>
    )
  }
}
