import { column as c, table, type TableRow } from 'remix/data-table'

let ts = () => c.timestamp({ withTimezone: true })

export const auditEvents = table({
  name: 'audit_events',
  columns: {
    id: c.bigint(),
    occurred_at: ts(),
    actor_type: c.enum(['staff', 'slack', 'system'] as const),
    actor_id: c.text().nullable(),
    action: c.text(),
    request_id: c.uuid().nullable(),
    detail: c.json(),
  },
})

export const targets = table({
  name: 'targets',
  columns: {
    id: c.uuid(),
    slug: c.text(),
    name: c.text(),
    type: c.enum(['endpoint', 'airtable', 'slack', 'loops', 'hackatime', 'auth'] as const),
    audience: c.text().nullable(),
    config: c.json(),
    enabled: c.boolean(),
    created_at: ts(),
    updated_at: ts(),
  },
})

export const requests = table({
  name: 'requests',
  columns: {
    id: c.uuid(),
    type: c.enum(['delete', 'export'] as const),
    status: c.enum([
      'received',
      'resolving',
      'dry_running',
      'awaiting_approval',
      'executing',
      'completed',
      'partially_failed',
      'rejected',
    ] as const),
    source: c.enum(['manual', 'airtable'] as const),
    source_ref: c.text().nullable(),
    created_by: c.text().nullable(),
    decision: c.enum(['approved', 'rejected'] as const).nullable(),
    decided_by_type: c.enum(['staff', 'slack'] as const).nullable(),
    decided_by: c.text().nullable(),
    decided_at: ts().nullable(),
    completed_at: ts().nullable(),
    redacted_at: ts().nullable(),
    created_at: ts(),
    updated_at: ts(),
  },
})

export const requestIdentifiers = table({
  name: 'request_identifiers',
  columns: {
    id: c.bigint(),
    request_id: c.uuid(),
    kind: c.enum(['email', 'identity_id', 'slack_id'] as const),
    value: c.text(),
    source: c.enum(['intake', 'hackclub_auth'] as const),
    hashed: c.boolean(),
    created_at: ts(),
  },
})

export const targetResults = table({
  name: 'target_results',
  columns: {
    id: c.bigint(),
    request_id: c.uuid(),
    target_id: c.uuid(),
    phase: c.enum(['dry_run', 'execute'] as const),
    status: c.enum(['pending', 'done', 'failed', 'retrying'] as const),
    attempts: c.integer(),
    found: c.boolean().nullable(),
    deleted: c.json().nullable(),
    retained: c.json().nullable(),
    error_code: c.text().nullable(),
    http_status: c.integer().nullable(),
    next_attempt_at: ts().nullable(),
    finished_at: ts().nullable(),
    claimed_until: ts().nullable(),
    created_at: ts(),
    updated_at: ts(),
  },
})

export type AuditEvent = TableRow<typeof auditEvents>
export type Target = TableRow<typeof targets>
export type PrivacyRequest = TableRow<typeof requests>
export type RequestIdentifier = TableRow<typeof requestIdentifiers>
export type RequestType = PrivacyRequest['type']
export type RequestStatus = PrivacyRequest['status']
export type TargetPhase = TableRow<typeof targetResults>['phase']
export type TargetResultStatus = TableRow<typeof targetResults>['status']
