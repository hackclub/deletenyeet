import type { Handle, RemixNode } from 'remix/component'

import type { AlertType } from './alert.tsx'
import { Icon } from './icon.tsx'

export interface FlashItem {
  id: string
  type: AlertType
  header?: RemixNode
  content?: RemixNode
  action?: RemixNode
  dismissible?: boolean
}

export function Flashbar(handle: Handle<{ items: FlashItem[] }>) {
  return () => {
    let { items } = handle.props
    if (items.length === 0) return null
    return (
      <ul class="flashbar" aria-label="Notifications">
        {items.map((item) => (
          <li
            key={item.id}
            class={`flash flash--${item.type}`}
            role={item.type === 'error' ? 'alert' : 'status'}
            data-context={item.type === 'warning' ? 'flashbar-warning' : 'flashbar'}
          >
            <Icon name={`status-${item.type}`} label={item.type} />
            <div class="flash__body">
              {item.header ? <div class="flash__header">{item.header}</div> : null}
              {item.content ? <div>{item.content}</div> : null}
            </div>
            {item.action ? <div class="flash__action">{item.action}</div> : null}
            {item.dismissible ? (
              <>
                <input
                  type="checkbox"
                  id={`flash-dismiss-${item.id}`}
                  class="flash__dismiss-state visually-hidden"
                  aria-label="Dismiss notification"
                />
                <label for={`flash-dismiss-${item.id}`} class="flash__dismiss" title="Dismiss">
                  <Icon name="close" />
                </label>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }
}
