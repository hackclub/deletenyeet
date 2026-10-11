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
  return () => (
    <span class={`status status--${handle.props.type}`}>
      <Icon name={`status-${handle.props.type}`} />
      <span>{handle.props.children}</span>
    </span>
  )
}
