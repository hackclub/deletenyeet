import type { Database } from 'remix/data-table'

import { auditEvents } from './tables.ts'

export type AuditActor =
  | { type: 'staff'; id: string }
  | { type: 'slack'; id: string }
  | { type: 'system'; id?: undefined }

export async function recordAudit(
  db: Database,
  e: { actor: AuditActor; action: string; requestId?: string; detail?: Record<string, unknown> },
) {
  await db.create(auditEvents, {
    actor_type: e.actor.type,
    actor_id: e.actor.id ?? null,
    action: e.action,
    request_id: e.requestId ?? null,
    detail: e.detail ?? {},
  })
}
