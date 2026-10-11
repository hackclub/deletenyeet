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

export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
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
  constructor(message: string) {
    super(message)
    this.name = 'RequestStateError'
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export interface NewRequest {
  type: RequestType
  email: string
  slackId?: string | null
  identityId?: string | null
  actor: AuditActor
  source: { kind: 'manual'; createdBy: string } | { kind: 'airtable'; recordId: string }
}

export async function createRequest(db: Database, input: NewRequest): Promise<PrivacyRequest> {
  return db.transaction(async (tx) => {
    let request = await tx.create(
      requests,
      {
        type: input.type,
        source: input.source.kind,
        source_ref: input.source.kind === 'airtable' ? input.source.recordId : null,
        created_by: input.source.kind === 'manual' ? input.source.createdBy : null,
      },
      { returnRow: true },
    )
    await tx.create(requestIdentifiers, {
      request_id: request.id,
      kind: 'email',
      value: normalizeEmail(input.email),
      source: 'intake',
    })
    let extra = [
      input.slackId ? { kind: 'slack_id' as const, value: input.slackId } : null,
      input.identityId ? { kind: 'identity_id' as const, value: input.identityId } : null,
    ].filter((entry) => entry !== null)
    for (let entry of extra) {
      await tx.create(requestIdentifiers, { request_id: request.id, ...entry, source: 'intake' })
    }
    await recordAudit(tx, {
      actor: input.actor,
      action: 'request.created',
      requestId: request.id,
      detail: { type: input.type, source: input.source.kind },
    })
    return request
  })
}

export interface Transition {
  requestId: string
  from: RequestStatus
  to: RequestStatus
  actor: AuditActor
  detail?: Record<string, unknown>
}

export async function transitionRequest(db: Database, transition: Transition): Promise<void> {
  let { requestId, from, to, actor } = transition
  if (!REQUEST_TRANSITIONS[from].includes(to)) {
    throw new RequestStateError(`request cannot move from ${from} to ${to}`)
  }

  await db.transaction(async (tx) => {
    let result = await tx.updateMany(
      requests,
      { status: to, ...(to === 'completed' || to === 'partially_failed' ? { completed_at: new Date() } : {}) },
      { where: { id: requestId, status: from } },
    )
    if (result.affectedRows !== 1) {
      throw new RequestStateError(`request is no longer ${from}`)
    }
    await recordAudit(tx, {
      actor,
      action: 'request.status_changed',
      requestId,
      detail: { from, to, ...transition.detail },
    })
  })
}

export interface Decision {
  requestId: string
  decision: 'approved' | 'rejected'
  actor: Extract<AuditActor, { type: 'staff' | 'slack' }>
  from: RequestStatus
}

export async function decideRequest(db: Database, input: Decision): Promise<void> {
  let to: RequestStatus = input.decision === 'approved' ? 'executing' : 'rejected'
  if (input.decision === 'approved' && input.from !== 'awaiting_approval') {
    throw new RequestStateError('only requests awaiting approval can be approved')
  }
  if (!REQUEST_TRANSITIONS[input.from].includes(to)) {
    throw new RequestStateError(`request cannot move from ${input.from} to ${to}`)
  }

  await db.transaction(async (tx) => {
    let result = await tx.updateMany(
      requests,
      {
        status: to,
        decision: input.decision,
        decided_by_type: input.actor.type,
        decided_by: input.actor.id,
        decided_at: new Date(),
      },
      { where: { id: input.requestId, status: input.from, decision: null } },
    )
    if (result.affectedRows !== 1) {
      throw new RequestStateError(`request is no longer ${input.from} or was already decided`)
    }
    await recordAudit(tx, {
      actor: input.actor,
      action: `request.${input.decision}`,
      requestId: input.requestId,
      detail: { from: input.from, to },
    })
  })
}
