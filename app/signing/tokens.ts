import { randomBytes } from 'node:crypto'

import { errors, jwtVerify, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose'

import { SafeError } from '../log.ts'
import { SIGNING_ALG, type Keyring } from './keyring.ts'

const ISSUER = 'hackclub-privacy'
const TTL = 300
const TYP = 'JWT'

export type TokenAction = 'delete' | 'export'

export interface TokenSubject {
  emails: string[]
  slack_id: string | null
  identity_id: string | null
}

interface Claims extends JWTPayload {
  iss: typeof ISSUER
  aud: string
  iat: number
  exp: number
  jti: string
  request_id: string
  action: TokenAction
  dry_run: boolean
  subject: TokenSubject
}

export class TokenError extends SafeError {
  override name = 'TokenError'
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function mintTargetToken(
  keyring: Keyring,
  i: {
    requestId: string
    targetSlug: string
    audience: string
    action: TokenAction
    dryRun: boolean
    attempt: number
    subject: TokenSubject
  },
): Promise<string> {
  if (!Number.isSafeInteger(i.attempt) || i.attempt < 1)
    throw new TokenError('invalid_attempt', 'attempt must be a positive integer')
  if (!i.audience) throw new TokenError('invalid_audience', 'audience is required')
  let s = i.subject
  if (!isSubject(s) || (!s.emails.length && s.slack_id === null && s.identity_id === null))
    throw new TokenError('invalid_subject', 'subject needs at least one identifier')

  let iat = Math.floor(Date.now() / 1000)
  // the random tail keeps ids unique even when an attempt number repeats, since programs reject a reused jti
  let jti = `${i.requestId}-${i.targetSlug}-${i.action}-${i.attempt}-${randomBytes(6).toString('hex')}`
  return new SignJWT({ request_id: i.requestId, action: i.action, dry_run: i.dryRun, subject: s })
    .setProtectedHeader({ alg: SIGNING_ALG, kid: keyring.activeKid, typ: TYP })
    .setIssuer(ISSUER)
    .setAudience(i.audience)
    .setIssuedAt(iat)
    .setExpirationTime(iat + TTL)
    .setJti(jti)
    .sign(keyring.signingKey)
}

export async function verifyTargetToken(
  token: string,
  keys: JWTVerifyGetKey,
  o: { audience: string; clockToleranceSeconds?: number; currentDate?: Date },
): Promise<Claims> {
  let tolerance = o.clockToleranceSeconds ?? 30
  let p = await jwtVerify(token, keys, {
    issuer: ISSUER,
    audience: o.audience,
    algorithms: [SIGNING_ALG],
    typ: TYP,
    requiredClaims: ['iat', 'exp', 'jti'],
    maxTokenAge: TTL + tolerance,
    clockTolerance: tolerance,
    currentDate: o.currentDate,
  }).then(
    (r) => r.payload,
    (e) => {
      throw new TokenError(verifyErrorCode(e), 'token rejected')
    },
  )

  let check = (ok: boolean, code: string, message: string) => {
    if (!ok) throw new TokenError(code, message)
  }
  check(typeof p.aud === 'string', 'invalid_audience', 'aud must be a single string')
  check(
    typeof p.iat === 'number' && typeof p.exp === 'number' && p.exp - p.iat <= TTL,
    'invalid_lifetime',
    `token lifetime must be at most ${TTL}s`,
  )
  check(isFilled(p.jti), 'invalid_jti', 'jti is required')
  check(isFilled(p.request_id), 'invalid_request_id', 'request_id is required')
  check(
    p.action === 'delete' || p.action === 'export',
    'invalid_action',
    'action must be delete or export',
  )
  check(typeof p.dry_run === 'boolean', 'invalid_dry_run', 'dry_run must be a boolean')
  check(isSubject(p.subject), 'invalid_subject', 'subject is malformed')
  return p as Claims
}

function verifyErrorCode(e: unknown): string {
  if (e instanceof errors.JWTExpired) return 'expired'
  if (e instanceof errors.JWTClaimValidationFailed) return `invalid_${e.claim}`
  if (e instanceof errors.JWSSignatureVerificationFailed) return 'bad_signature'
  if (e instanceof errors.JWKSNoMatchingKey) return 'unknown_kid'
  if (e instanceof errors.JOSEAlgNotAllowed) return 'alg_not_allowed'
  if (e instanceof errors.JWSInvalid || e instanceof errors.JWTInvalid) return 'malformed'
  return 'unverifiable'
}

const isFilled = (v: unknown) => typeof v === 'string' && v.length > 0

function isSubject(v: unknown): v is TokenSubject {
  if (typeof v !== 'object' || v === null) return false
  let s = v as Record<string, unknown>
  return (
    Array.isArray(s.emails) &&
    s.emails.every(isFilled) &&
    (s.slack_id === null || isFilled(s.slack_id)) &&
    (s.identity_id === null || isFilled(s.identity_id))
  )
}
