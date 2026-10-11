import { sql, type Database } from 'remix/data-table'

import type { AuditActor } from '../data/audit.ts'
import { recordAudit } from '../data/audit.ts'
import { decideRequest, RequestStateError, transitionRequest } from '../data/requests.ts'
import { requests, targets, type RequestStatus, type TargetPhase } from '../data/tables.ts'
import { enqueueCall } from '../jobs/boss.ts'
import { logError } from '../log.ts'
import { TokenError } from '../signing/tokens.ts'
import { buildTarget } from '../targets/registry.ts'
import { TargetCallError } from '../targets/types.ts'
import { loadSubject } from './subject.ts'

export const MAX_ATTEMPTS = 5
const LEASE_SECONDS = 60
const STALE_SECONDS = 30

const SYSTEM: AuditActor = { type: 'system' }

export function retryDelaySeconds(attempt: number): number {
  return 10 * 3 ** (attempt - 1)
}

function rows<T>(result: { rows?: unknown[] }): T[] {
  return (result.rows ?? []) as T[]
}

async function openResultIds(
  db: Database,
  requestId: string,
  phase: TargetPhase,
): Promise<string[]> {
  let result = await db.exec(sql`
    select id::text as id from target_results
    where request_id = ${requestId} and phase = ${phase} and status in ('pending', 'retrying')
  `)
  return rows<{ id: string }>(result).map((row) => row.id)
}

async function enqueueOpen(db: Database, requestId: string, phase: TargetPhase) {
  for (let id of await openResultIds(db, requestId, phase)) {
    await enqueueCall(id)
  }
}

export async function startDryRun(
  db: Database,
  requestId: string,
  from: 'resolving' | 'awaiting_approval',
  actor: AuditActor,
) {
  await db.transaction(async (tx) => {
    await transitionRequest(tx, { requestId, from, to: 'dry_running', actor })
    let inserted = await tx.exec(sql`
      insert into target_results (request_id, target_id, phase)
      select ${requestId}, id, 'dry_run' from targets where enabled
      on conflict (request_id, target_id, phase) do update set
        status = 'pending', attempts = 0, found = null, deleted = null, retained = null, error_code = null,
        http_status = null, next_attempt_at = null, finished_at = null, claimed_until = null
      where target_results.status = 'failed'
    `)
    await recordAudit(tx, {
      actor,
      action: 'request.dry_run_started',
      requestId,
      detail: { targets: inserted.affectedRows ?? 0 },
    })
  })
  await enqueueOpen(db, requestId, 'dry_run')
  await finishPhaseIfComplete(db, requestId, 'dry_run')
}

export async function approveRequest(
  db: Database,
  requestId: string,
  actor: Extract<AuditActor, { type: 'staff' | 'slack' }>,
) {
  await db.transaction(async (tx) => {
    let blocking = await tx.exec(sql`
      select count(*)::int as count from target_results
      where request_id = ${requestId} and phase = 'dry_run' and status <> 'done'
    `)
    if ((rows<{ count: number }>(blocking)[0]?.count ?? 0) > 0) {
      throw new RequestStateError('every dry run must succeed before approval')
    }
    await decideRequest(tx, { requestId, decision: 'approved', from: 'awaiting_approval', actor })
    let inserted = await tx.exec(sql`
      insert into target_results (request_id, target_id, phase)
      select request_id, target_id, 'execute' from target_results
      where request_id = ${requestId} and phase = 'dry_run'
      on conflict do nothing
    `)
    await recordAudit(tx, {
      actor,
      action: 'request.execution_started',
      requestId,
      detail: { targets: inserted.affectedRows ?? 0 },
    })
  })
  await enqueueOpen(db, requestId, 'execute')
  await finishPhaseIfComplete(db, requestId, 'execute')
}

export async function rejectRequest(
  db: Database,
  requestId: string,
  from: RequestStatus,
  actor: Extract<AuditActor, { type: 'staff' | 'slack' }>,
) {
  await db.transaction(async (tx) => {
    await decideRequest(tx, { requestId, decision: 'rejected', from, actor })
    let cancelled = await tx.exec(sql`
      update target_results set status = 'failed', error_code = 'request_rejected',
        next_attempt_at = null, claimed_until = null, finished_at = now()
      where request_id = ${requestId} and status in ('pending', 'retrying')
    `)
    if ((cancelled.affectedRows ?? 0) > 0) {
      await recordAudit(tx, {
        actor,
        action: 'targets.cancelled',
        requestId,
        detail: { count: cancelled.affectedRows ?? 0 },
      })
    }
  })
}

interface Claim {
  request_id: string
  target_id: string
  phase: TargetPhase
  attempts: number
}

export async function runTargetCall(db: Database, resultId: string) {
  let claimed = await db.exec(sql`
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
  `)
  let claim = rows<Claim>(claimed)[0]
  if (!claim) {
    await failExhausted(db, resultId)
    return
  }

  let request = await db.find(requests, claim.request_id)
  let target = await db.find(targets, claim.target_id)
  let activeStatus: RequestStatus = claim.phase === 'dry_run' ? 'dry_running' : 'executing'
  let detail = {
    target: target?.slug ?? claim.target_id,
    phase: claim.phase,
    attempt: claim.attempts,
  }

  try {
    if (!request || !target) throw new TargetCallError('missing_row', false)
    if (request.status !== activeStatus) throw new TargetCallError('request_not_active', false)
    let subject = await loadSubject(db, request.id)
    let call = { requestId: request.id, action: request.type, attempt: claim.attempts }
    let implementation = buildTarget(target)
    let result =
      claim.phase === 'dry_run'
        ? await implementation.dryRun(subject, call)
        : await implementation.execute(subject, call)

    await db.transaction(async (tx) => {
      await tx.exec(sql`
        update target_results set status = 'done', found = ${result.found},
          deleted = ${JSON.stringify(result.deleted)}::jsonb, retained = ${JSON.stringify(result.retained)}::jsonb,
          error_code = null, http_status = null, claimed_until = null, finished_at = now()
        where id = ${resultId}
      `)
      await recordAudit(tx, {
        actor: SYSTEM,
        action: 'target.done',
        requestId: claim.request_id,
        detail: { ...detail, found: result.found },
      })
    })
  } catch (error) {
    let failure =
      error instanceof TargetCallError
        ? error
        : error instanceof TokenError
          ? new TargetCallError(error.code, false)
          : new TargetCallError('internal_error', false)
    if (!(error instanceof TargetCallError)) logError(`target call ${claim.request_id}`, error)

    if (failure.retryable && claim.attempts < MAX_ATTEMPTS) {
      let delay = retryDelaySeconds(claim.attempts)
      let nextAttempt = new Date(Date.now() + delay * 1000)
      await db.transaction(async (tx) => {
        await tx.exec(sql`
          update target_results set status = 'retrying', error_code = ${failure.code},
            http_status = ${failure.httpStatus}, next_attempt_at = ${nextAttempt}, claimed_until = null
          where id = ${resultId}
        `)
        await recordAudit(tx, {
          actor: SYSTEM,
          action: 'target.retry_scheduled',
          requestId: claim.request_id,
          detail: { ...detail, error: failure.code, retry_in_seconds: delay },
        })
      })
      console.warn(
        `request ${claim.request_id} target ${detail.target} ${claim.phase} attempt ${claim.attempts} ${failure.code}, retrying in ${delay}s`,
      )
      await enqueueCall(resultId, nextAttempt)
      return
    }

    await db.transaction(async (tx) => {
      await tx.exec(sql`
        update target_results set status = 'failed', error_code = ${failure.code},
          http_status = ${failure.httpStatus}, next_attempt_at = null, claimed_until = null, finished_at = now()
        where id = ${resultId}
      `)
      await recordAudit(tx, {
        actor: SYSTEM,
        action: 'target.failed',
        requestId: claim.request_id,
        detail: { ...detail, error: failure.code },
      })
    })
    console.warn(
      `request ${claim.request_id} target ${detail.target} ${claim.phase} failed: ${failure.code}`,
    )
  }

  await finishPhaseIfComplete(db, claim.request_id, claim.phase)
}

async function failExhausted(db: Database, resultId: string) {
  let exhausted = await db.transaction(async (tx) => {
    let result = await tx.exec(sql`
      update target_results set status = 'failed', error_code = coalesce(error_code, 'attempts_exhausted'),
        next_attempt_at = null, claimed_until = null, finished_at = now()
      where id = ${resultId} and status in ('pending', 'retrying') and attempts >= ${MAX_ATTEMPTS}
        and (claimed_until is null or claimed_until < now())
      returning request_id::text, phase, attempts
    `)
    let row = rows<{ request_id: string; phase: TargetPhase; attempts: number }>(result)[0]
    if (row) {
      await recordAudit(tx, {
        actor: SYSTEM,
        action: 'target.failed',
        requestId: row.request_id,
        detail: {
          result: resultId,
          phase: row.phase,
          attempt: row.attempts,
          error: 'attempts_exhausted',
        },
      })
    }
    return row
  })
  if (exhausted) await finishPhaseIfComplete(db, exhausted.request_id, exhausted.phase)
}

export async function finishPhaseIfComplete(db: Database, requestId: string, phase: TargetPhase) {
  let counts = rows<{ open: number; failed: number; total: number }>(
    await db.exec(sql`
      select
        count(*) filter (where status in ('pending', 'retrying'))::int as open,
        count(*) filter (where status = 'failed')::int as failed,
        count(*)::int as total
      from target_results where request_id = ${requestId} and phase = ${phase}
    `),
  )[0] ?? { open: 0, failed: 0, total: 0 }
  if (counts.open > 0) return

  let from: RequestStatus = phase === 'dry_run' ? 'dry_running' : 'executing'
  let to: RequestStatus =
    phase === 'dry_run' ? 'awaiting_approval' : counts.failed > 0 ? 'partially_failed' : 'completed'
  try {
    await transitionRequest(db, {
      requestId,
      from,
      to,
      actor: SYSTEM,
      detail: { targets: counts.total, failed: counts.failed },
    })
  } catch (error) {
    if (!(error instanceof RequestStateError)) throw error
  }
}

export async function resolveRequest(db: Database, requestId: string) {
  let request = await db.find(requests, requestId)
  if (!request) return
  if (request.status === 'received') {
    await transitionRequest(db, { requestId, from: 'received', to: 'resolving', actor: SYSTEM })
  } else if (request.status !== 'resolving') {
    return
  }

  let subject = await loadSubject(db, requestId)
  await recordAudit(db, {
    actor: SYSTEM,
    action: 'request.resolved',
    requestId,
    detail: {
      resolver: 'stub',
      emails: subject.emails.length,
      slack_id: subject.slack_id !== null,
      identity_id: subject.identity_id !== null,
    },
  })
  await startDryRun(db, requestId, 'resolving', SYSTEM)
}

export async function sweep(db: Database) {
  let due = rows<{ id: string }>(
    await db.exec(sql`
      select id::text as id from target_results
      where status in ('pending', 'retrying')
        and (next_attempt_at is null or next_attempt_at <= now())
        and (claimed_until is null or claimed_until < now())
        and updated_at < now() - make_interval(secs => ${STALE_SECONDS})
      limit 200
    `),
  )
  for (let row of due) await enqueueCall(row.id)

  let stalled = rows<{ id: string; status: RequestStatus }>(
    await db.exec(sql`
      select id::text as id, status from requests
      where status in ('received', 'resolving', 'dry_running', 'executing')
        and updated_at < now() - make_interval(secs => ${STALE_SECONDS})
      limit 200
    `),
  )
  for (let request of stalled) {
    try {
      if (request.status === 'received' || request.status === 'resolving') {
        await resolveRequest(db, request.id)
      } else {
        await finishPhaseIfComplete(
          db,
          request.id,
          request.status === 'dry_running' ? 'dry_run' : 'execute',
        )
      }
    } catch (error) {
      logError(`sweep ${request.id}`, error)
    }
  }
}
