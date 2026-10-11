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

export interface ResultView {
  id: string
  phase: TargetPhase
  status: TargetResultStatus
  attempts: number
  found: boolean | null
  deleted: Record<string, number> | null
  retained: { type: string; count: number; reason: string }[] | null
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
  let identifiers = await db.findMany(requestIdentifiers, { where: { request_id: id }, orderBy: ['id', 'asc'] })
  let audit = await db.findMany(auditEvents, { where: { request_id: id }, orderBy: ['id', 'asc'] })
  let result = await db.exec(sql`
    select r.id::text as id, r.phase, r.status, r.attempts, r.found, r.deleted, r.retained,
      r.error_code, r.http_status, r.next_attempt_at,
      (r.claimed_until is not null and r.claimed_until > now()) as in_flight,
      t.name as target_name, t.slug as target_slug
    from target_results r join targets t on t.id = r.target_id
    where r.request_id = ${id}
    order by t.name, r.phase
  `)
  let results = (result.rows ?? []).map((row) => {
    let r = row as Record<string, unknown>
    return {
      id: r.id as string,
      phase: r.phase as TargetPhase,
      status: r.status as TargetResultStatus,
      attempts: r.attempts as number,
      found: r.found as boolean | null,
      deleted: r.deleted as ResultView['deleted'],
      retained: r.retained as ResultView['retained'],
      errorCode: r.error_code as string | null,
      httpStatus: r.http_status as number | null,
      nextAttemptAt: r.next_attempt_at as Date | null,
      inFlight: r.in_flight as boolean,
      targetName: r.target_name as string,
      targetSlug: r.target_slug as string,
    }
  })
  return { request, identifiers, results, audit }
}

export async function listRequests(db: Database): Promise<PrivacyRequest[]> {
  return db.findMany(requests, { orderBy: ['created_at', 'desc'], limit: 500 })
}
