import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'

export const AutoRefresh = clientEntry(
  import.meta.url + '#AutoRefresh',
  function AutoRefresh(handle: Handle<{ seconds: number; active: boolean }>) {
    let reloading = false
    let submitting = false

    handle.queueTask(() => {
      handle.frame.addEventListener(
        'reloadStart',
        () => {
          reloading = true
        },
        {
          signal: handle.signal,
        },
      )
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          reloading = false
          void handle.update()
        },
        { signal: handle.signal },
      )

      document.addEventListener(
        'submit',
        (event) => {
          let form = event.target
          if (form instanceof HTMLFormElement && form.hasAttribute('data-rmx-document')) {
            submitting = true
          }
        },
        { signal: handle.signal },
      )
    })

    return () => {
      if (handle.props.active && !reloading && !submitting) {
        handle.queueTask((signal) => {
          let timer = setTimeout(() => {
            if (signal.aborted || reloading || submitting) return
            if (document.visibilityState === 'visible') {
              void handle.frame.reload().catch(() => {})
            } else {
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
