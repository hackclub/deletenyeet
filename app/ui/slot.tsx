import type { RemixNode } from 'remix/component'

// Wraps n in a div of class c, or renders nothing when n is empty
export const slot = (c: string, n?: RemixNode) => (n ? <div class={c}>{n}</div> : null)
