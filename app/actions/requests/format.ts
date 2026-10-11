import type { RequestStatus, TargetResultStatus } from '../../data/tables.ts'
import type { StatusType } from '../../ui/status-indicator.tsx'

export const REQUEST_STATUS: Record<RequestStatus, { type: StatusType; label: string }> = {
  received: { type: 'pending', label: 'Received' },
  resolving: { type: 'in-progress', label: 'Resolving' },
  dry_running: { type: 'in-progress', label: 'Dry running' },
  awaiting_approval: { type: 'pending', label: 'Awaiting approval' },
  executing: { type: 'in-progress', label: 'Executing' },
  completed: { type: 'success', label: 'Completed' },
  partially_failed: { type: 'error', label: 'Partially failed' },
  rejected: { type: 'stopped', label: 'Rejected' },
}

export const ACTIVE_STATUSES: RequestStatus[] = ['received', 'resolving', 'dry_running', 'executing']

export function resultStatus(status: TargetResultStatus, inFlight: boolean): { type: StatusType; label: string } {
  if (status === 'done') return { type: 'success', label: 'Done' }
  if (status === 'failed') return { type: 'error', label: 'Failed' }
  if (status === 'retrying') return { type: 'warning', label: 'Retrying' }
  return inFlight ? { type: 'in-progress', label: 'Calling' } : { type: 'pending', label: 'Pending' }
}

export function formatTime(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== 'string') return '-'
  let date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
