import { sql, type Database } from 'remix/data-table'

import { recordAudit, type AuditActor } from '../data/audit.ts'
import { decideRequest, RequestStateError, transitionRequest } from '../data/requests.ts'
import {
  requestIdentifiers,
  requests,
  targets,
  type RequestStatus,
  type TargetPhase,
} from '../data/tables.ts'
import { enqueueCall } from '../jobs/boss.ts'
import { logError } from '../log.ts'
import { TokenError } from '../signing/tokens.ts'
import { buildTarget } from '../targets/registry.ts'
import { TargetCallError, type Subject } from '../targets/types.ts'

const MAX_ATTEMPTS = 5
const LEASE_SECONDS = 60
const STALE_SECONDS = 30
const SYSTEM: AuditActor = { type: 'system' }
const ACTIVE = { dry_run: 'dry_running', execute: 'executing' } as const

type Decider = Extract<AuditActor, { type: 'staff' | 'slack' }>
type Detail = Record<string, unknown>

let rows = <T>(r: { rows?: unknown[] }) => (r.rows ?? []) as T[]
let audit = (
  db: Database,
  action: string,
  requestId: string,
  detail: Detail,
  actor: AuditActor = SYSTEM,
) => recordAudit(db, { actor, action, requestId, detail })

async function loadSubject(db: Database, requestId: string): Promise<Subject> {
  let ids = await db.findMany(requestIdentifiers, {
    where: { request_id: requestId, hashed: false },
    orderBy: ['id', 'asc'],
  })
  let one = (kind: string) => ids.find((i) => i.kind === kind)?.value ?? null
  return {
    emails: ids.filter((i) => i.kind === 'email').map((i) => i.value),
    slack_id: one('slack_id'),
    identity_id: one('identity_id'),
  }
}

// enqueue every open call in the phase, then close it if nothing was open
async function kick(db: Database, requestId: string, phase: TargetPhase) {
  let open = await db.exec(sql`
    select id::text as id from target_results
    where request_id = ${requestId} and phase = ${phase} and status in ('pending', 'retrying')
  `)
  for (let { id } of rows<{ id: string }>(open)) await enqueueCall(id)
  await finishPhase(db, requestId, phase)
}

export async function startDryRun(
  db: Database,
  requestId: string,
  from: 'resolving' | 'awaiting_approval',
  actor: AuditActor,
) {
  await db.transaction(async (tx) => {
    await transitionRequest(tx, { requestId, from, to: 'dry_running', actor })
    let r = await tx.exec(sql`
      insert into target_results (request_id, target_id, phase)
      select ${requestId}, id, 'dry_run' from targets where enabled
      on conflict (request_id, target_id, phase) do update set
        status = 'pending', attempts = 0, found = null, deleted = null, retained = null, error_code = null,
        http_status = null, next_attempt_at = null, finished_at = null, claimed_until = null
      where target_results.status = 'failed'
    `)
    await audit(tx, 'request.dry_run_started', requestId, { targets: r.affectedRows ?? 0 }, actor)
  })
  await kick(db, requestId, 'dry_run')
}

export async function approveRequest(db: Database, requestId: string, actor: Decider) {
  await db.transaction(async (tx) => {
    let [b] = rows<{ count: number }>(
      await tx.exec(sql`
        select count(*)::int as count from target_results
        where request_id = ${requestId} and phase = 'dry_run' and status <> 'done'
      `),
    )
    if (b?.count) throw new RequestStateError('every dry run must succeed before approval')
    await decideRequest(tx, { requestId, decision: 'approved', from: 'awaiting_approval', actor })
    let r = await tx.exec(sql`
      insert into target_results (request_id, target_id, phase)
      select request_id, target_id, 'execute' from target_results
      where request_id = ${requestId} and phase = 'dry_run'
      on conflict do nothing
    `)
    await audit(tx, 'request.execution_started', requestId, { targets: r.affectedRows ?? 0 }, actor)
  })
  await kick(db, requestId, 'execute')
}

export async function rejectRequest(
  db: Database,
  requestId: string,
  from: RequestStatus,
  actor: Decider,
) {
  await db.transaction(async (tx) => {
    await decideRequest(tx, { requestId, decision: 'rejected', from, actor })
    let n =
      (
        await tx.exec(sql`
          update target_results set status = 'failed', error_code = 'request_rejected',
            next_attempt_at = null, claimed_until = null, finished_at = now()
          where request_id = ${requestId} and status in ('pending', 'retrying')
        `)
      ).affectedRows ?? 0
    if (n > 0) await audit(tx, 'targets.cancelled', requestId, { count: n }, actor)
  })
}

export async function runTargetCall(db: Database, resultId: string) {
  let [claim] = rows<{
    request_id: string
    target_id: string
    phase: TargetPhase
    attempts: number
  }>(
    await db.exec(sql`
      update target_results r set
        attempts = r.attempts + 1,
        status = 'pending',
        next_attempt_at = null,
        claimed_until = now() + make_interval(secs => ${LEASE_SECONDS})
      where r.id = ${resultId}
        and r.status in ('pending', 'retrying')
        and (r.next_attempt_at is null or r.next_attempt_at <= now())
        and (r.claimed_until is null or r.claimed_until < now())
        and r.attempts < ${MAX_ATTEMPTS}
      returning r.request_id::text, r.target_id::text, r.phase, r.attempts
    `),
  )
  if (!claim) return failExhausted(db, resultId)

  let { request_id: requestId, phase, attempts } = claim
  let request = await db.find(requests, requestId)
  let target = await db.find(targets, claim.target_id)
  let detail = { target: target?.slug ?? claim.target_id, phase, attempt: attempts }
  let settle = (update: ReturnType<typeof sql>, action: string, extra: Detail) =>
    db.transaction(async (tx) => {
      await tx.exec(update)
      await audit(tx, action, requestId, { ...detail, ...extra })
    })

  try {
    if (!request || !target) throw new TargetCallError('missing_row', false)
    if (request.status !== ACTIVE[phase]) throw new TargetCallError('request_not_active', false)
    let subject = await loadSubject(db, request.id)
    let r = await buildTarget(target)[phase === 'dry_run' ? 'dryRun' : 'execute'](subject, {
      requestId: request.id,
      action: request.type,
      attempt: attempts,
    })
    await settle(
      sql`
        update target_results set status = 'done', found = ${r.found},
          deleted = ${JSON.stringify(r.deleted)}::jsonb, retained = ${JSON.stringify(r.retained)}::jsonb,
          error_code = null, http_status = null, claimed_until = null, finished_at = now()
        where id = ${resultId}
      `,
      'target.done',
      { found: r.found },
    )
  } catch (error) {
    if (!(error instanceof TargetCallError)) logError(`target call ${requestId}`, error)
    let f =
      error instanceof TargetCallError
        ? error
        : new TargetCallError(error instanceof TokenError ? error.code : 'internal_error', false)
    let where = `request ${requestId} target ${detail.target} ${phase}`

    if (f.retryable && attempts < MAX_ATTEMPTS) {
      let delay = 10 * 3 ** (attempts - 1)
      let next = new Date(Date.now() + delay * 1000)
      await settle(
        sql`
          update target_results set status = 'retrying', error_code = ${f.code},
            http_status = ${f.httpStatus}, next_attempt_at = ${next}, claimed_until = null
          where id = ${resultId}
        `,
        'target.retry_scheduled',
        { error: f.code, retry_in_seconds: delay },
      )
      console.warn(`${where} attempt ${attempts} ${f.code}, retrying in ${delay}s`)
      await enqueueCall(resultId, next)
      return
    }

    await settle(
      sql`
        update target_results set status = 'failed', error_code = ${f.code},
          http_status = ${f.httpStatus}, next_attempt_at = null, claimed_until = null, finished_at = now()
        where id = ${resultId}
      `,
      'target.failed',
      { error: f.code },
    )
    console.warn(`${where} failed: ${f.code}`)
  }

  await finishPhase(db, requestId, phase)
}

async function failExhausted(db: Database, resultId: string) {
  let row = await db.transaction(async (tx) => {
    let [r] = rows<{ request_id: string; phase: TargetPhase; attempts: number }>(
      await tx.exec(sql`
        update target_results set status = 'failed', error_code = coalesce(error_code, 'attempts_exhausted'),
          next_attempt_at = null, claimed_until = null, finished_at = now()
        where id = ${resultId} and status in ('pending', 'retrying') and attempts >= ${MAX_ATTEMPTS}
          and (claimed_until is null or claimed_until < now())
        returning request_id::text, phase, attempts
      `),
    )
    if (r)
      await audit(tx, 'target.failed', r.request_id, {
        result: resultId,
        phase: r.phase,
        attempt: r.attempts,
        error: 'attempts_exhausted',
      })
    return r
  })
  if (row) await finishPhase(db, row.request_id, row.phase)
}

async function finishPhase(db: Database, requestId: string, phase: TargetPhase) {
  let [c = { open: 0, failed: 0, total: 0 }] = rows<{
    open: number
    failed: number
    total: number
  }>(
    await db.exec(sql`
      select
        count(*) filter (where status in ('pending', 'retrying'))::int as open,
        count(*) filter (where status = 'failed')::int as failed,
        count(*)::int as total
      from target_results where request_id = ${requestId} and phase = ${phase}
    `),
  )
  if (c.open > 0) return
  await transitionRequest(db, {
    requestId,
    from: ACTIVE[phase],
    to: phase === 'dry_run' ? 'awaiting_approval' : c.failed > 0 ? 'partially_failed' : 'completed',
    actor: SYSTEM,
    detail: { targets: c.total, failed: c.failed },
  }).catch((error) => {
    if (!(error instanceof RequestStateError)) throw error
  })
}

export async function resolveRequest(db: Database, requestId: string) {
  let status = (await db.find(requests, requestId))?.status
  if (status === 'received')
    await transitionRequest(db, { requestId, from: 'received', to: 'resolving', actor: SYSTEM })
  else if (status !== 'resolving') return

  let s = await loadSubject(db, requestId)
  await audit(db, 'request.resolved', requestId, {
    resolver: 'stub',
    emails: s.emails.length,
    slack_id: s.slack_id !== null,
    identity_id: s.identity_id !== null,
  })
  await startDryRun(db, requestId, 'resolving', SYSTEM)
}

export async function sweep(db: Database) {
  let due = await db.exec(sql`
    select id::text as id from target_results
    where status in ('pending', 'retrying')
      and (next_attempt_at is null or next_attempt_at <= now())
      and (claimed_until is null or claimed_until < now())
      and updated_at < now() - make_interval(secs => ${STALE_SECONDS})
    limit 200
  `)
  for (let { id } of rows<{ id: string }>(due)) await enqueueCall(id)

  let stalled = await db.exec(sql`
    select id::text as id, status from requests
    where status in ('received', 'resolving', 'dry_running', 'executing')
      and updated_at < now() - make_interval(secs => ${STALE_SECONDS})
    limit 200
  `)
  for (let { id, status } of rows<{ id: string; status: RequestStatus }>(stalled)) {
    try {
      if (status === 'received' || status === 'resolving') await resolveRequest(db, id)
      else await finishPhase(db, id, status === 'dry_running' ? 'dry_run' : 'execute')
    } catch (error) {
      logError(`sweep ${id}`, error)
    }
  }
}
