import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const REQUEST_TYPES = ['delete', 'export'] as const
export const REQUEST_STATUSES = [
  'received',
  'resolving',
  'dry_running',
  'awaiting_approval',
  'executing',
  'completed',
  'partially_failed',
  'rejected',
] as const
export const REQUEST_SOURCES = ['manual', 'airtable'] as const
export const IDENTIFIER_KINDS = ['email', 'identity_id', 'slack_id'] as const
export const IDENTIFIER_SOURCES = ['intake', 'hackclub_auth'] as const
export const TARGET_TYPES = ['endpoint', 'airtable', 'slack', 'loops', 'hackatime', 'auth'] as const
export const TARGET_PHASES = ['dry_run', 'execute'] as const
export const TARGET_RESULT_STATUSES = ['pending', 'done', 'failed', 'retrying'] as const

export type RequestType = (typeof REQUEST_TYPES)[number]
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export type IdentifierKind = (typeof IDENTIFIER_KINDS)[number]
export type TargetType = (typeof TARGET_TYPES)[number]
export type TargetPhase = (typeof TARGET_PHASES)[number]
export type TargetResultStatus = (typeof TARGET_RESULT_STATUSES)[number]

export const auditEvents = table({
  name: 'audit_events',
  columns: {
    id: c.bigint(),
    occurred_at: c.timestamp({ withTimezone: true }),
    actor_type: c.enum(['staff', 'slack', 'system']),
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
    type: c.enum(TARGET_TYPES),
    audience: c.text().nullable(),
    config: c.json(),
    enabled: c.boolean(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export const requests = table({
  name: 'requests',
  columns: {
    id: c.uuid(),
    type: c.enum(REQUEST_TYPES),
    status: c.enum(REQUEST_STATUSES),
    source: c.enum(REQUEST_SOURCES),
    source_ref: c.text().nullable(),
    created_by: c.text().nullable(),
    decision: c.enum(['approved', 'rejected']).nullable(),
    decided_by_type: c.enum(['staff', 'slack']).nullable(),
    decided_by: c.text().nullable(),
    decided_at: c.timestamp({ withTimezone: true }).nullable(),
    completed_at: c.timestamp({ withTimezone: true }).nullable(),
    redacted_at: c.timestamp({ withTimezone: true }).nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export const requestIdentifiers = table({
  name: 'request_identifiers',
  columns: {
    id: c.bigint(),
    request_id: c.uuid(),
    kind: c.enum(IDENTIFIER_KINDS),
    value: c.text(),
    source: c.enum(IDENTIFIER_SOURCES),
    hashed: c.boolean(),
    created_at: c.timestamp({ withTimezone: true }),
  },
})

export const targetResults = table({
  name: 'target_results',
  columns: {
    id: c.bigint(),
    request_id: c.uuid(),
    target_id: c.uuid(),
    phase: c.enum(TARGET_PHASES),
    status: c.enum(TARGET_RESULT_STATUSES),
    attempts: c.integer(),
    found: c.boolean().nullable(),
    deleted: c.json().nullable(),
    retained: c.json().nullable(),
    error_code: c.text().nullable(),
    http_status: c.integer().nullable(),
    next_attempt_at: c.timestamp({ withTimezone: true }).nullable(),
    finished_at: c.timestamp({ withTimezone: true }).nullable(),
    claimed_until: c.timestamp({ withTimezone: true }).nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export type AuditEvent = TableRow<typeof auditEvents>
export type Target = TableRow<typeof targets>
export type PrivacyRequest = TableRow<typeof requests>
export type RequestIdentifier = TableRow<typeof requestIdentifiers>
export type TargetResultRow = TableRow<typeof targetResults>
