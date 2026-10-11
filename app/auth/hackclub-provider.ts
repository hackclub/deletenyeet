import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createOAuthProvider, type OAuthProvider, type OAuthTokens } from 'remix/auth'

import { SafeError } from '../log.ts'

type LoginErrorCode =
  | 'idp_error'
  | 'discovery_failed'
  | 'missing_code'
  | 'invalid_transaction'
  | 'token_exchange_failed'
  | 'invalid_token_response'
  | 'id_token_invalid'
  | 'nonce_mismatch'
  | 'userinfo_failed'
  | 'userinfo_mismatch'

export class LoginError extends SafeError {
  override name = 'LoginError'
  constructor(
    readonly code: LoginErrorCode,
    options?: ErrorOptions,
  ) {
    super(`login failed: ${code}`, options)
  }
}

export interface HackClubProfile {
  sub: string
  name: string | null
  slackId: string | null
}

interface Options {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  pkce: boolean
}

const ENDPOINTS = [
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'jwks_uri',
] as const
type Discovery = Record<'issuer' | (typeof ENDPOINTS)[number], string>
type Discovered = { metadata: Discovery; jwks: ReturnType<typeof createRemoteJWKSet> }

const ALG = 'RS256'

export function createHackClubAuthProvider(
  o: Options,
): OAuthProvider<HackClubProfile, 'hackclub'> & { discover(): Promise<Discovery> } {
  let cached: Promise<Discovered> | undefined
  let discover = () =>
    (cached ??= loadDiscovery(o.issuer).catch((e) => {
      cached = undefined
      throw e
    }))

  let provider = createOAuthProvider<HackClubProfile, 'hackclub'>('hackclub', {
    async createAuthorizationURL(t) {
      let { metadata } = await discover()
      let nonce = randomBytes(32).toString('base64url')
      t.providerState = JSON.stringify({ nonce })
      let url = new URL(metadata.authorization_endpoint)
      for (let [k, v] of Object.entries({
        response_type: 'code',
        client_id: o.clientId,
        redirect_uri: o.redirectUri,
        scope: 'openid profile',
        state: t.state,
        nonce,
        ...(o.pkce && {
          code_challenge: createHash('sha256').update(t.codeVerifier).digest('base64url'),
          code_challenge_method: 'S256',
        }),
      }))
        url.searchParams.set(k, v)
      return url
    },

    async handleCallback(context, t) {
      let { metadata, jwks } = await discover()
      let nonce = parseNonce(t.providerState)
      let code = context.url.searchParams.get('code')
      if (!code) throw new LoginError('missing_code')

      let tokens = await exchangeCode(metadata, o, code, t.codeVerifier)
      let claims = await verifyIdToken(tokens.idToken, jwks, metadata.issuer, o.clientId)
      if (!isFilled(claims.nonce) || !safeEqual(claims.nonce, nonce))
        throw new LoginError('nonce_mismatch')

      let info = await fetchJson('userinfo_failed', metadata.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      if (typeof info.sub !== 'string') throw new LoginError('userinfo_failed')
      if (info.sub !== claims.sub) throw new LoginError('userinfo_mismatch')

      let { sub } = claims
      let pick = (k: string) => str(info[k]) ?? str(claims[k])
      return {
        provider: 'hackclub',
        account: { provider: 'hackclub', providerAccountId: sub },
        profile: { sub, name: pick('name'), slackId: pick('slack_id') },
        tokens,
      }
    },
  })

  return Object.assign(provider, { discover: async () => (await discover()).metadata })
}

async function fetchJson(
  code: LoginErrorCode,
  url: string | URL,
  init: { method?: string; headers?: Record<string, string>; body?: URLSearchParams } = {},
) {
  let r = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  }).catch((cause) => {
    throw new LoginError(code, { cause })
  })
  if (!r.ok) throw new LoginError(code)
  return ((await r.json().catch(() => null)) ?? {}) as Record<string, unknown>
}

async function loadDiscovery(issuer: string): Promise<Discovered> {
  let m = await fetchJson('discovery_failed', new URL('/.well-known/openid-configuration', issuer))
  if (m.issuer !== issuer)
    throw new SafeError(`discovery issuer ${String(m.issuer)} does not match ${issuer}`)
  for (let k of ENDPOINTS)
    if (!isFilled(m[k])) throw new SafeError(`discovery document is missing ${k}`)
  let algs = m.id_token_signing_alg_values_supported as string[] | undefined
  if (algs && !algs.includes(ALG)) throw new SafeError(`issuer does not sign id tokens with ${ALG}`)
  let d = m as Discovery
  return { metadata: d, jwks: createRemoteJWKSet(new URL(d.jwks_uri)) }
}

async function exchangeCode(
  m: Discovery,
  o: Options,
  code: string,
  verifier: string,
): Promise<OAuthTokens & { idToken: string }> {
  let body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: o.redirectUri,
  })
  if (o.pkce) body.set('code_verifier', verifier)
  let enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+')
  let j = await fetchJson('token_exchange_failed', m.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${enc(o.clientId)}:${enc(o.clientSecret)}`)}`,
    },
    body,
  })
  if (
    typeof j.access_token !== 'string' ||
    typeof j.id_token !== 'string' ||
    (typeof j.token_type === 'string' && j.token_type.toLowerCase() !== 'bearer')
  )
    throw new LoginError('invalid_token_response')
  return { accessToken: j.access_token, idToken: j.id_token, tokenType: 'Bearer' }
}

async function verifyIdToken(
  token: string,
  jwks: Discovered['jwks'],
  issuer: string,
  clientId: string,
) {
  let { payload: p } = await jwtVerify(token, jwks, {
    issuer,
    audience: clientId,
    algorithms: [ALG],
    requiredClaims: ['sub', 'iat', 'exp'],
    clockTolerance: 30,
  }).catch((cause) => {
    throw new LoginError('id_token_invalid', { cause })
  })
  if ((Array.isArray(p.aud) && p.aud.length > 1 && p.azp !== clientId) || !isFilled(p.sub))
    throw new LoginError('id_token_invalid')
  return p as JWTPayload & { sub: string }
}

function parseNonce(v: string | undefined): string {
  try {
    let { nonce } = JSON.parse(v ?? '')
    if (isFilled(nonce)) return nonce
  } catch {}
  throw new LoginError('invalid_transaction')
}

const isFilled = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const str = (v: unknown) => (isFilled(v) ? v : null)

function safeEqual(a: string, b: string) {
  let [x, y] = [Buffer.from(a), Buffer.from(b)]
  return x.length === y.length && timingSafeEqual(x, y)
}
