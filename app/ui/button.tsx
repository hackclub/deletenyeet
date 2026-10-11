import type { Handle, RemixNode } from 'remix/component'

import { Icon, type IconName } from './icon.tsx'

export interface ButtonProps {
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
}

export function Button(handle: Handle<ButtonProps>) {
  return () => {
    let { children, variant = 'normal', href, iconName, ariaLabel, fullWidth, ...rest } = handle.props
    let className = [
      'button',
      `button--${variant}`,
      iconName && children == null ? 'button--icon' : null,
      fullWidth ? 'button--full-width' : null,
    ]
      .filter(Boolean)
      .join(' ')
    let content = (
      <>
        {iconName ? <Icon name={iconName} /> : null}
        {children}
      </>
    )

    if (href !== undefined && !rest.disabled) {
      return (
        <a class={className} href={href} aria-label={ariaLabel}>
          {content}
        </a>
      )
    }

    return (
      <button
        class={className}
        type={rest.type ?? 'button'}
        name={rest.name}
        value={rest.value}
        form={rest.form}
        disabled={rest.disabled}
        aria-label={ariaLabel}
        popovertarget={rest.popovertarget}
        popovertargetaction={rest.popovertargetaction}
      >
        {content}
      </button>
    )
  }
}
