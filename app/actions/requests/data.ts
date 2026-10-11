import { sql, type Database } from 'remix/data-table'

import {
  auditEvents,
  requestIdentifiers,
  requests,
  type AuditEvent,
  type PrivacyRequest,
  type RequestIdentifier,
  type TargetPhase,
  type TargetResultStatus,
} from '../../data/tables.ts'
import type { TargetResult } from '../../targets/types.ts'

export interface ResultView {
  id: string
  phase: TargetPhase
  status: TargetResultStatus
  attempts: number
  found: boolean | null
  deleted: TargetResult['deleted'] | null
  retained: TargetResult['retained'] | null
  errorCode: string | null
  httpStatus: number | null
  nextAttemptAt: Date | null
  inFlight: boolean
  targetName: string
  targetSlug: string
}

export interface RequestDetail {
  request: PrivacyRequest
  identifiers: RequestIdentifier[]
  results: ResultView[]
  audit: AuditEvent[]
}

export async function loadRequestDetail(db: Database, id: string): Promise<RequestDetail | null> {
  let request = await db.find(requests, id)
  if (!request) return null
  let q = { where: { request_id: id }, orderBy: ['id', 'asc'] as ['id', 'asc'] }
  let [identifiers, audit, { rows }] = await Promise.all([
    db.findMany(requestIdentifiers, q),
    db.findMany(auditEvents, q),
    db.exec(sql`
      select r.id::text as id, r.phase, r.status, r.attempts, r.found, r.deleted, r.retained,
        r.error_code as "errorCode", r.http_status as "httpStatus", r.next_attempt_at as "nextAttemptAt",
        (r.claimed_until is not null and r.claimed_until > now()) as "inFlight",
        t.name as "targetName", t.slug as "targetSlug"
      from target_results r join targets t on t.id = r.target_id
      where r.request_id = ${id}
      order by t.name, r.phase
    `),
  ])
  return { request, identifiers, results: (rows ?? []) as unknown as ResultView[], audit }
}

export const listRequests = (db: Database) =>
  db.findMany(requests, { orderBy: ['created_at', 'desc'], limit: 500 })
