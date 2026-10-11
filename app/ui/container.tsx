import type { Handle, RemixNode } from 'remix/component'

export interface ContainerProps {
  header?: RemixNode
  footer?: RemixNode
  disableContentPaddings?: boolean
  children?: RemixNode
}

export function Container(handle: Handle<ContainerProps>) {
  return () => {
    let { header, footer, disableContentPaddings, children } = handle.props
    return (
      <section class="container">
        {header ? <div class="container__header">{header}</div> : null}
        <div class={disableContentPaddings ? 'container__content--flush' : 'container__content'}>
          {children}
        </div>
        {footer ? <div class="container__footer">{footer}</div> : null}
      </section>
    )
  }
}
