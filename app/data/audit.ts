import type { Database } from 'remix/data-table'

import { auditEvents } from './tables.ts'

export type AuditActor =
  | { type: 'staff'; id: string }
  | { type: 'slack'; id: string }
  | { type: 'system'; id?: undefined }

export interface AuditEntry {
  actor: AuditActor
  action: string
  requestId?: string
  detail?: Record<string, unknown>
}

export async function recordAudit(db: Database, entry: AuditEntry) {
  await db.create(auditEvents, {
    actor_type: entry.actor.type,
    actor_id: entry.actor.id ?? null,
    action: entry.action,
    request_id: entry.requestId ?? null,
    detail: entry.detail ?? {},
  })
}
