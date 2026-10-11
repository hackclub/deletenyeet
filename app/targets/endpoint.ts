import { keyring } from '../signing/keys.ts'
import { mintTargetToken } from '../signing/tokens.ts'
import {
  parseTargetResult,
  TargetCallError,
  type CallContext,
  type Subject,
  type Target,
} from './types.ts'

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])

export function readEndpointConfig(config: unknown): { url: string } | null {
  let { url } = (config ?? {}) as { url?: unknown }
  let u = typeof url === 'string' ? URL.parse(url) : null
  return u && (u.protocol === 'https:' || u.protocol === 'http:')
    ? { url: u.href.replace(/\/+$/, '') }
    : null
}

let json = (res: Response) =>
  res.json().then(
    (b) => b as Record<string, unknown> | null,
    () => null,
  )

export function createEndpointTarget(o: {
  slug: string
  audience: string
  config: { url: string }
}): Target {
  async function call(
    subject: Subject,
    { requestId, action, attempt }: CallContext,
    dryRun: boolean,
  ) {
    let token = await mintTargetToken(keyring, {
      requestId,
      targetSlug: o.slug,
      audience: o.audience,
      action,
      dryRun,
      attempt,
      subject,
    })

    let res: Response
    try {
      res = await fetch(`${o.config.url}/api/privacy/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      let timeout = error instanceof DOMException && error.name === 'TimeoutError'
      throw new TargetCallError(timeout ? 'timeout' : 'network_error', true)
    }

    let { status } = res
    if (!res.ok) {
      // programs answer errors as {"error": "snake_case_code"}; anything else is dropped so no personal data lands in error_code
      let code = (await json(res))?.error
      let reason = typeof code === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(code) ? `_${code}` : ''
      throw new TargetCallError(`http_${status}${reason}`, RETRYABLE.has(status), status)
    }

    let body = await json(res)
    let result =
      body?.request_id === requestId && body.dry_run === dryRun && parseTargetResult(body)
    if (!result) throw new TargetCallError('invalid_response', false, status)
    return result
  }

  return {
    dryRun: (s, c) => call(s, c, true),
    execute: (s, c) => call(s, c, false),
  }
}
