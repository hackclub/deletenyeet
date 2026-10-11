import type { Handle, RemixNode } from 'remix/component'

import { notice, role, type AlertType } from './alert.tsx'
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
  return () =>
    handle.props.items.length ? (
      <ul class="flashbar" aria-label="Notifications">
        {handle.props.items.map(({ id, type, header, content, action, dismissible }) => (
          <li
            key={id}
            class={`flash flash--${type}`}
            role={role(type)}
            data-context={type === 'warning' ? 'flashbar-warning' : 'flashbar'}
          >
            {notice('flash', type, header, content, action)}
            {dismissible ? (
              <>
                <input
                  type="checkbox"
                  id={`flash-dismiss-${id}`}
                  class="flash__dismiss-state visually-hidden"
                  aria-label="Dismiss notification"
                />
                <label for={`flash-dismiss-${id}`} class="flash__dismiss" title="Dismiss">
                  <Icon name="close" />
                </label>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null
}
