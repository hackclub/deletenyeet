import type { Handle, RemixNode } from 'remix/component'

export interface KeyValueItem {
  label: string
  value: RemixNode
}

export function KeyValuePairs(handle: Handle<{ items: KeyValueItem[]; columns?: 1 | 2 | 3 | 4 }>) {
  return () => {
    let { items, columns = 3 } = handle.props
    return (
      <dl class="key-value" style={{ '--kv-columns': String(columns) }}>
        {items.map((item) => (
          <div key={item.label} class="key-value__pair">
            <dt>{item.label}</dt>
            <dd>{item.value ?? '-'}</dd>
          </div>
        ))}
      </dl>
    )
  }
}
