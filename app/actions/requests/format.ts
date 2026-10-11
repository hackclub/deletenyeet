import type { RequestStatus, TargetResultStatus } from '../../data/tables.ts'
import type { StatusType } from '../../ui/status-indicator.tsx'

type Status = { type: StatusType; label: string }

export const REQUEST_STATUS: Record<RequestStatus, Status> = {
  received: { type: 'pending', label: 'Received' },
  resolving: { type: 'in-progress', label: 'Resolving' },
  dry_running: { type: 'in-progress', label: 'Dry running' },
  awaiting_approval: { type: 'pending', label: 'Awaiting approval' },
  executing: { type: 'in-progress', label: 'Executing' },
  completed: { type: 'success', label: 'Completed' },
  partially_failed: { type: 'error', label: 'Partially failed' },
  rejected: { type: 'stopped', label: 'Rejected' },
}

const RESULT_STATUS: Record<TargetResultStatus, Status> = {
  done: { type: 'success', label: 'Done' },
  failed: { type: 'error', label: 'Failed' },
  retrying: { type: 'warning', label: 'Retrying' },
  pending: { type: 'pending', label: 'Pending' },
}

export const ACTIVE_STATUSES: RequestStatus[] = [
  'received',
  'resolving',
  'dry_running',
  'executing',
]

export const resultStatus = (status: TargetResultStatus, inFlight: boolean): Status =>
  status === 'pending' && inFlight
    ? { type: 'in-progress', label: 'Calling' }
    : RESULT_STATUS[status]

export function formatTime(value: unknown): string {
  let d = value instanceof Date || typeof value === 'string' ? new Date(value) : null
  return d && !Number.isNaN(d.getTime())
    ? `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`
    : '-'
}

export const shortId = (id: string) => id.slice(0, 8)

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
