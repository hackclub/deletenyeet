import type { Handle, RemixNode } from 'remix/component'

import { slot } from './slot.tsx'

export function Container(
  handle: Handle<{
    header?: RemixNode
    footer?: RemixNode
    disableContentPaddings?: boolean
    children?: RemixNode
  }>,
) {
  return () => {
    let { header, footer, disableContentPaddings, children } = handle.props
    return (
      <section class="container">
        {slot('container__header', header)}
        <div class={disableContentPaddings ? 'container__content--flush' : 'container__content'}>
          {children}
        </div>
        {slot('container__footer', footer)}
      </section>
    )
  }
}
