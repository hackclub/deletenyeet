import type { Handle, RemixNode } from 'remix/component'

import { Button } from './button.tsx'

export function Modal(
  handle: Handle<{ id: string; header: RemixNode; footer?: RemixNode; children?: RemixNode }>,
) {
  return () => {
    let { id, header, footer, children } = handle.props
    return (
      <div
        id={id}
        popover="auto"
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <div class="modal__header">
          <h2 class="modal__title" id={`${id}-title`}>
            {header}
          </h2>
          <Button
            variant="link"
            iconName="close"
            ariaLabel="Close"
            popovertarget={id}
            popovertargetaction="hide"
          />
        </div>
        {children ? <div class="modal__content">{children}</div> : null}
        {footer ? <div class="modal__footer">{footer}</div> : null}
      </div>
    )
  }
}
