import type { Database } from 'remix/data-table'

import { SafeError } from '../log.ts'
import { recordAudit, type AuditActor } from './audit.ts'
import {
  requestIdentifiers,
  requests,
  type PrivacyRequest,
  type RequestStatus,
  type RequestType,
} from './tables.ts'

const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  received: ['resolving', 'rejected'],
  resolving: ['dry_running', 'rejected'],
  dry_running: ['awaiting_approval', 'rejected'],
  awaiting_approval: ['executing', 'rejected', 'dry_running'],
  executing: ['completed', 'partially_failed'],
  completed: [],
  partially_failed: [],
  rejected: [],
}

export class RequestStateError extends SafeError {
  override name = 'RequestStateError'
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

function check(from: RequestStatus, to: RequestStatus) {
  if (!TRANSITIONS[from].includes(to))
    throw new RequestStateError(`request cannot move from ${from} to ${to}`)
}

// compare-and-set on the request row so concurrent moves lose cleanly
async function update(
  db: Database,
  where: { id: string; status: RequestStatus; decision?: null },
  changes: Partial<PrivacyRequest>,
  stale: string,
) {
  if ((await db.updateMany(requests, changes, { where })).affectedRows !== 1)
    throw new RequestStateError(stale)
}

export async function createRequest(
  db: Database,
  input: {
    type: RequestType
    email: string
    slackId?: string | null
    identityId?: string | null
    actor: AuditActor
    source: { kind: 'manual'; createdBy: string } | { kind: 'airtable'; recordId: string }
  },
) {
  let { type, source } = input
  return db.transaction(async (tx) => {
    let request = await tx.create(
      requests,
      {
        type,
        source: source.kind,
        source_ref: source.kind === 'airtable' ? source.recordId : null,
        created_by: source.kind === 'manual' ? source.createdBy : null,
      },
      { returnRow: true },
    )
    let ids = [
      ['email', normalizeEmail(input.email)],
      ['slack_id', input.slackId],
      ['identity_id', input.identityId],
    ] as const
    for (let [kind, value] of ids)
      if (value)
        await tx.create(requestIdentifiers, {
          request_id: request.id,
          kind,
          value,
          source: 'intake',
        })
    await recordAudit(tx, {
      actor: input.actor,
      action: 'request.created',
      requestId: request.id,
      detail: { type, source: source.kind },
    })
    return request
  })
}

export async function transitionRequest(
  db: Database,
  t: {
    requestId: string
    from: RequestStatus
    to: RequestStatus
    actor: AuditActor
    detail?: Record<string, unknown>
  },
) {
  let { requestId, from, to } = t
  check(from, to)
  await db.transaction(async (tx) => {
    await update(
      tx,
      { id: requestId, status: from },
      {
        status: to,
        ...(to === 'completed' || to === 'partially_failed' ? { completed_at: new Date() } : {}),
      },
      `request is no longer ${from}`,
    )
    await recordAudit(tx, {
      actor: t.actor,
      action: 'request.status_changed',
      requestId,
      detail: { from, to, ...t.detail },
    })
  })
}

export async function decideRequest(
  db: Database,
  d: {
    requestId: string
    decision: 'approved' | 'rejected'
    actor: Extract<AuditActor, { type: 'staff' | 'slack' }>
    from: RequestStatus
  },
) {
  let { requestId, decision, actor, from } = d
  let to: RequestStatus = decision === 'approved' ? 'executing' : 'rejected'
  if (decision === 'approved' && from !== 'awaiting_approval')
    throw new RequestStateError('only requests awaiting approval can be approved')
  check(from, to)
  await db.transaction(async (tx) => {
    await update(
      tx,
      { id: requestId, status: from, decision: null },
      {
        status: to,
        decision,
        decided_by_type: actor.type,
        decided_by: actor.id,
        decided_at: new Date(),
      },
      `request is no longer ${from} or was already decided`,
    )
    await recordAudit(tx, { actor, action: `request.${decision}`, requestId, detail: { from, to } })
  })
}
