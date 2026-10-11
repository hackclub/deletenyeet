import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

// Reload this region after each completed render, without overlapping requests.
export const AutoRefresh = clientEntry(
  import.meta.url + '#AutoRefresh',
  function AutoRefresh(handle: Handle<{ seconds: number; active: boolean }>) {
    return () => {
      if (handle.props.active) {
        handle.queueTask((signal) => {
          let timer = setTimeout(() => {
            if (!signal.aborted && document.visibilityState === 'visible') {
              void handle.frame.reload().catch(() => {})
            } else if (!signal.aborted) {
              void handle.update()
            }
          }, handle.props.seconds * 1000)
          signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
        })
      }
      return null
    }
  },
)
