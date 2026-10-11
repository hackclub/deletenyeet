import { SafeError } from '../log.ts'
import type { TokenAction, TokenSubject } from '../signing/tokens.ts'

export type Subject = TokenSubject
type Retained = { type: string; count: number; reason: string }

export interface TargetResult {
  found: boolean
  deleted: Record<string, number>
  retained: Retained[]
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
  override name = 'TargetCallError'
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly httpStatus: number | null = null,
  ) {
    super(`target call failed: ${code}`)
  }
}

let isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
let isLabel = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100

// rebuilds the body field by field so nothing the program adds reaches the database
export function parseTargetResult(value: unknown): TargetResult | null {
  let { found, deleted, retained } = (value ?? {}) as Record<string, unknown>
  if (typeof found !== 'boolean' || typeof deleted !== 'object' || !deleted) return null
  if (Array.isArray(deleted) || !Array.isArray(retained)) return null
  let d = Object.entries(deleted)
  let r = retained.map((i) => {
    let { type, count, reason } = (i ?? {}) as Record<string, unknown>
    return { type, count, reason }
  })
  return d.every((e): e is [string, number] => isLabel(e[0]) && isCount(e[1])) &&
    r.every(
      (i): i is Retained =>
        isLabel(i.type) &&
        isCount(i.count) &&
        typeof i.reason === 'string' &&
        i.reason.length <= 500,
    )
    ? { found, deleted: Object.fromEntries(d), retained: r }
    : null
}
