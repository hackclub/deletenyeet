import { keyring } from '../signing/keys.ts'
import { mintTargetToken } from '../signing/tokens.ts'
import {
  parseTargetResult,
  TargetCallError,
  type CallContext,
  type Subject,
  type Target,
  type TargetResult,
} from './types.ts'

const TIMEOUT_MS = 15_000
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export interface EndpointConfig {
  url: string
}

export function readEndpointConfig(config: unknown): EndpointConfig | null {
  if (typeof config !== 'object' || config === null) return null
  let url = (config as Record<string, unknown>).url
  if (typeof url !== 'string') return null
  try {
    let parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return { url: parsed.href.replace(/\/+$/, '') }
  } catch {
    return null
  }
}

export function createEndpointTarget(options: {
  slug: string
  audience: string
  config: EndpointConfig
}): Target {
  async function call(
    subject: Subject,
    context: CallContext,
    dryRun: boolean,
  ): Promise<TargetResult> {
    let token = await mintTargetToken(keyring, {
      requestId: context.requestId,
      targetSlug: options.slug,
      audience: options.audience,
      action: context.action,
      dryRun,
      attempt: context.attempt,
      subject,
    })

    let response: Response
    try {
      response = await fetch(`${options.config.url}/api/privacy/${context.action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      let timedOut = error instanceof DOMException && error.name === 'TimeoutError'
      throw new TargetCallError(timedOut ? 'timeout' : 'network_error', true)
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw new TargetCallError(
        `http_${response.status}`,
        RETRYABLE_STATUSES.has(response.status),
        response.status,
      )
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new TargetCallError('invalid_response', false, response.status)
    }
    let echo = body as Record<string, unknown> | null
    if (echo?.request_id !== context.requestId || echo?.dry_run !== dryRun) {
      throw new TargetCallError('invalid_response', false, response.status)
    }
    let result = parseTargetResult(body)
    if (!result) throw new TargetCallError('invalid_response', false, response.status)
    return result
  }

  return {
    dryRun: (subject, context) => call(subject, context, true),
    execute: (subject, context) => call(subject, context, false),
  }
}
