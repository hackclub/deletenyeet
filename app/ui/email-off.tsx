import { unsafeHTML } from 'remix/component'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function emailOff(text: string, className?: string) {
  return (
    <span
      class={className}
      innerHTML={unsafeHTML(`<!--email_off-->${escape(text)}<!--/email_off-->`)}
    />
  )
}
