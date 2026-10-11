import type { Handle, RemixNode } from 'remix/component'

import { Icon, type IconName } from './icon.tsx'

export function Button(
  handle: Handle<{
    children?: RemixNode
    variant?: 'primary' | 'normal' | 'link'
    href?: string
    type?: 'button' | 'submit' | 'reset'
    name?: string
    value?: string
    form?: string
    disabled?: boolean
    iconName?: IconName
    ariaLabel?: string
    fullWidth?: boolean
    popovertarget?: string
    popovertargetaction?: 'hide' | 'show' | 'toggle'
  }>,
) {
  return () => {
    let {
      children,
      variant = 'normal',
      href,
      iconName,
      ariaLabel,
      fullWidth,
      ...rest
    } = handle.props
    let c = [
      'button',
      `button--${variant}`,
      iconName && children == null && 'button--icon',
      fullWidth && 'button--full-width',
    ]
      .filter(Boolean)
      .join(' ')
    let b = (
      <>
        {iconName ? <Icon name={iconName} /> : null}
        {children}
      </>
    )
    return href !== undefined && !rest.disabled ? (
      <a class={c} href={href} aria-label={ariaLabel}>
        {b}
      </a>
    ) : (
      <button {...rest} class={c} type={rest.type ?? 'button'} aria-label={ariaLabel}>
        {b}
      </button>
    )
  }
}
