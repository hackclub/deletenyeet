import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'

export type StatusType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'stopped'
  | 'pending'
  | 'in-progress'
  | 'loading'

export function StatusIndicator(handle: Handle<{ type: StatusType; children: RemixNode }>) {
  return () => {
    let { type, children } = handle.props
    return (
      <span class={`status status--${type}`}>
        <Icon name={`status-${type}`} />
        <span>{children}</span>
      </span>
    )
  }
}
