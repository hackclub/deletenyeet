import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'

export type AlertType = 'info' | 'success' | 'warning' | 'error'

export function Alert(
  handle: Handle<{
    type?: AlertType
    header?: RemixNode
    action?: RemixNode
    children?: RemixNode
  }>,
) {
  return () => {
    let { type = 'info', header, action, children } = handle.props
    return (
      <div
        class={`alert alert--${type}`}
        role={type === 'error' ? 'alert' : 'status'}
        data-context="alert"
      >
        <Icon name={`status-${type}`} label={type} />
        <div class="alert__body">
          {header ? <div class="alert__header">{header}</div> : null}
          {children ? <div>{children}</div> : null}
        </div>
        {action ? <div class="alert__action">{action}</div> : null}
      </div>
    )
  }
}
