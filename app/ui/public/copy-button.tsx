import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'

export const CopyButton = clientEntry(
  import.meta.url + '#CopyButton',
  function CopyButton(handle: Handle<{ text: string; label: string }>) {
    let ready = false
    let status = ''
    return () => {
      if (!ready) {
        handle.queueTask(() => {
          ready = true
          void handle.update()
        })
      }
      return (
        <span class="prompt-copy" hidden={!ready}>
          <button
            type="button"
            class="button button--primary"
            mix={on('click', async () => {
              try {
                await navigator.clipboard.writeText(handle.props.text)
                status = 'Copied'
              } catch {
                status = 'Could not copy, select the prompt below instead'
              }
              void handle.update()
            })}
          >
            {handle.props.label}
          </button>
          <span class="prompt-copy__status" role="status">
            {status}
          </span>
        </span>
      )
    }
  },
)
