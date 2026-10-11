import { SafeError } from '../log.ts'
import type { TokenAction, TokenSubject } from '../signing/tokens.ts'

export type Subject = TokenSubject

export interface TargetResult {
  found: boolean
  deleted: Record<string, number>
  retained: { type: string; count: number; reason: string }[]
}

export interface CallContext {
  requestId: string
  action: TokenAction
  attempt: number
}

export interface Target {
  dryRun(subject: Subject, call: CallContext): Promise<TargetResult>
  execute(subject: Subject, call: CallContext): Promise<TargetResult>
}

export class TargetCallError extends SafeError {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly httpStatus: number | null = null,
  ) {
    super(`target call failed: ${code}`)
    this.name = 'TargetCallError'
  }
}

export function parseTargetResult(value: unknown): TargetResult | null {
  if (typeof value !== 'object' || value === null) return null
  let body = value as Record<string, unknown>
  if (typeof body.found !== 'boolean') return null
  if (typeof body.deleted !== 'object' || body.deleted === null || Array.isArray(body.deleted)) return null
  let deleted: Record<string, number> = {}
  for (let [key, count] of Object.entries(body.deleted)) {
    if (!isCount(count) || !isLabel(key)) return null
    deleted[key] = count
  }
  if (!Array.isArray(body.retained)) return null
  let retained: TargetResult['retained'] = []
  for (let item of body.retained) {
    if (typeof item !== 'object' || item === null) return null
    let { type, count, reason } = item as Record<string, unknown>
    if (!isLabel(type) || !isCount(count) || typeof reason !== 'string' || reason.length > 500) return null
    retained.push({ type, count, reason })
  }
  return { found: body.found, deleted, retained }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isLabel(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 100
}
