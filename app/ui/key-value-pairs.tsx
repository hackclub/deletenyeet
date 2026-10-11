import type { Handle, RemixNode } from 'remix/component'

export function KeyValuePairs(
  handle: Handle<{ items: { label: string; value: RemixNode }[]; columns?: 1 | 2 | 3 | 4 }>,
) {
  return () => {
    let { items, columns = 3 } = handle.props
    return (
      <dl class="key-value" style={{ '--kv-columns': String(columns) }}>
        {items.map(({ label, value }) => (
          <div key={label} class="key-value__pair">
            <dt>{label}</dt>
            <dd>{value ?? '-'}</dd>
          </div>
        ))}
      </dl>
    )
  }
}
