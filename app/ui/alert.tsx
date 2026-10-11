import type { Handle, RemixNode } from 'remix/component'

import { Icon } from './icon.tsx'
import { slot } from './slot.tsx'

export type AlertType = 'info' | 'success' | 'warning' | 'error'

export const role = (t: AlertType) => (t === 'error' ? 'alert' : 'status')

// Icon, body, and action shared by Alert and Flashbar, with c as the class prefix
export const notice = (
  c: string,
  type: AlertType,
  header?: RemixNode,
  content?: RemixNode,
  action?: RemixNode,
) => (
  <>
    <Icon name={`status-${type}`} label={type} />
    <div class={`${c}__body`}>
      {slot(`${c}__header`, header)}
      {content ? <div>{content}</div> : null}
    </div>
    {slot(`${c}__action`, action)}
  </>
)

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
      <div class={`alert alert--${type}`} role={role(type)} data-context="alert">
        {notice('alert', type, header, children, action)}
      </div>
    )
  }
}
