import { errors, jwtVerify, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose'

import { SafeError } from '../log.ts'
import { SIGNING_ALG, type Keyring } from './keyring.ts'

export const TOKEN_ISSUER = 'hackclub-privacy'
export const TOKEN_TTL_SECONDS = 300
export const TOKEN_TYPE = 'JWT'

export type TokenAction = 'delete' | 'export'

export interface TokenSubject {
  emails: string[]
  slack_id: string | null
  identity_id: string | null
}

export interface TargetTokenClaims extends JWTPayload {
  iss: typeof TOKEN_ISSUER
  aud: string
  iat: number
  exp: number
  jti: string
  request_id: string
  action: TokenAction
  dry_run: boolean
  subject: TokenSubject
}

export interface MintInput {
  requestId: string
  targetSlug: string
  audience: string
  action: TokenAction
  dryRun: boolean
  attempt: number
  subject: TokenSubject
  now?: Date
}

export class TokenError extends SafeError {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'TokenError'
  }
}

export function tokenId(
  input: Pick<MintInput, 'requestId' | 'targetSlug' | 'action' | 'attempt'>,
): string {
  return `${input.requestId}-${input.targetSlug}-${input.action}-${input.attempt}`
}

export async function mintTargetToken(keyring: Keyring, input: MintInput): Promise<string> {
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1) {
    throw new TokenError('invalid_attempt', 'attempt must be a positive integer')
  }
  if (input.audience.length === 0) throw new TokenError('invalid_audience', 'audience is required')
  if (!isSubject(input.subject) || !hasIdentifier(input.subject)) {
    throw new TokenError('invalid_subject', 'subject needs at least one identifier')
  }

  let iat = Math.floor((input.now ?? new Date()).getTime() / 1000)
  return new SignJWT({
    request_id: input.requestId,
    action: input.action,
    dry_run: input.dryRun,
    subject: input.subject,
  })
    .setProtectedHeader({ alg: SIGNING_ALG, kid: keyring.activeKid, typ: TOKEN_TYPE })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(input.audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_TTL_SECONDS)
    .setJti(tokenId(input))
    .sign(keyring.signingKey)
}

export interface VerifyOptions {
  audience: string
  clockToleranceSeconds?: number
  currentDate?: Date
}

export async function verifyTargetToken(
  token: string,
  keys: JWTVerifyGetKey,
  options: VerifyOptions,
): Promise<TargetTokenClaims> {
  let tolerance = options.clockToleranceSeconds ?? 30
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(token, keys, {
      issuer: TOKEN_ISSUER,
      audience: options.audience,
      algorithms: [SIGNING_ALG],
      typ: TOKEN_TYPE,
      requiredClaims: ['iat', 'exp', 'jti'],
      maxTokenAge: TOKEN_TTL_SECONDS + tolerance,
      clockTolerance: tolerance,
      currentDate: options.currentDate,
    }))
  } catch (error) {
    throw new TokenError(verifyErrorCode(error), 'token rejected')
  }

  if (typeof payload.aud !== 'string')
    throw new TokenError('invalid_audience', 'aud must be a single string')
  if (
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp - payload.iat > TOKEN_TTL_SECONDS
  ) {
    throw new TokenError('invalid_lifetime', `token lifetime must be at most ${TOKEN_TTL_SECONDS}s`)
  }
  if (typeof payload.jti !== 'string' || payload.jti.length === 0)
    throw new TokenError('invalid_jti', 'jti is required')
  if (typeof payload.request_id !== 'string' || payload.request_id.length === 0) {
    throw new TokenError('invalid_request_id', 'request_id is required')
  }
  if (payload.action !== 'delete' && payload.action !== 'export') {
    throw new TokenError('invalid_action', 'action must be delete or export')
  }
  if (typeof payload.dry_run !== 'boolean')
    throw new TokenError('invalid_dry_run', 'dry_run must be a boolean')
  if (!isSubject(payload.subject)) throw new TokenError('invalid_subject', 'subject is malformed')

  return payload as TargetTokenClaims
}

function verifyErrorCode(error: unknown): string {
  if (error instanceof errors.JWTExpired) return 'expired'
  if (error instanceof errors.JWTClaimValidationFailed) return `invalid_${error.claim}`
  if (error instanceof errors.JWSSignatureVerificationFailed) return 'bad_signature'
  if (error instanceof errors.JWKSNoMatchingKey) return 'unknown_kid'
  if (error instanceof errors.JOSEAlgNotAllowed) return 'alg_not_allowed'
  if (error instanceof errors.JWSInvalid || error instanceof errors.JWTInvalid) return 'malformed'
  return 'unverifiable'
}

function isSubject(value: unknown): value is TokenSubject {
  if (typeof value !== 'object' || value === null) return false
  let subject = value as Record<string, unknown>
  return (
    Array.isArray(subject.emails) &&
    subject.emails.every((email) => typeof email === 'string' && email.length > 0) &&
    (subject.slack_id === null ||
      (typeof subject.slack_id === 'string' && subject.slack_id.length > 0)) &&
    (subject.identity_id === null ||
      (typeof subject.identity_id === 'string' && subject.identity_id.length > 0))
  )
}

function hasIdentifier(subject: TokenSubject): boolean {
  return subject.emails.length > 0 || subject.slack_id !== null || subject.identity_id !== null
}
