import type { Handle, RemixNode } from 'remix/component'

export function Prose(handle: Handle<{ children: RemixNode }>) {
  return () => <div class="prose">{handle.props.children}</div>
}

export function CodeBlock(handle: Handle<{ children: string }>) {
  return () => (
    <pre class="code-block">
      <code>{handle.props.children}</code>
    </pre>
  )
}
