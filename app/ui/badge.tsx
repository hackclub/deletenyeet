import type { Handle, RemixNode } from 'remix/component'

export function Badge(handle: Handle<{ color?: 'grey' | 'blue' | 'green' | 'red'; children: RemixNode }>) {
  return () => <span class={`badge badge--${handle.props.color ?? 'grey'}`}>{handle.props.children}</span>
}
