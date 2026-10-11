import type { Handle } from 'remix/component'

const PATHS = {
  menu: 'M2 4h12M2 8h12M2 12h12',
  close: 'm4 4 8 8M12 4l-8 8',
  'caret-down': 'm4 6 4 4 4-4',
  'caret-up': 'm4 10 4-4 4 4',
  sort: 'm5 6 3-3 3 3M5 10l3 3 3-3',
  search: 'M7 12.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM11 11l3.5 3.5',
  external: 'M10 2h4v4M14 2 8 8M12 9v4.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5H7',
  'status-success': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM5 8l2 2 4-4',
  'status-error': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM5.5 5.5l5 5M10.5 5.5l-5 5',
  'status-warning': 'M8 1.5 15 14H1L8 1.5ZM8 6v3.5M8 11.5v.5',
  'status-info': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 7v4.5M8 4.5V5',
  'status-stopped': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM5 8h6',
  'status-pending': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM8 4v4l2.5 2',
  'status-in-progress': 'M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM5 8h.01M8 8h.01M11 8h.01',
  'status-loading': 'M8 1.5a6.5 6.5 0 1 1-6.5 6.5',
} as const

export type IconName = keyof typeof PATHS

export function Icon(handle: Handle<{ name: IconName; label?: string }>) {
  return () => {
    let { name, label } = handle.props
    return (
      <svg
        class="icon"
        viewBox="0 0 16 16"
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        aria-label={label}
        focusable="false"
      >
        <path d={PATHS[name]} />
      </svg>
    )
  }
}
