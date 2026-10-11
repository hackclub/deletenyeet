import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createOAuthProvider, type OAuthProvider, type OAuthTokens } from 'remix/auth'

import { SafeError } from '../log.ts'

export const LOGIN_ERROR_CODES = [
  'idp_error',
  'discovery_failed',
  'missing_code',
  'invalid_transaction',
  'token_exchange_failed',
  'invalid_token_response',
  'id_token_invalid',
  'nonce_mismatch',
  'userinfo_failed',
  'userinfo_mismatch',
] as const

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number]

export class LoginError extends SafeError {
  override name = 'LoginError'
  readonly code: LoginErrorCode

  constructor(code: LoginErrorCode, options?: ErrorOptions) {
    super(`login failed: ${code}`, options)
    this.code = code
  }
}

export interface HackClubProfile {
  sub: string
  name: string | null
  slackId: string | null
}

export interface HackClubAuthOptions {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  pkce: boolean
  scopes?: string[]
}

interface DiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
  id_token_signing_alg_values_supported?: string[]
}

interface Discovered {
  metadata: DiscoveryDocument
  jwks: ReturnType<typeof createRemoteJWKSet>
}

interface ProviderState {
  nonce: string
}

export type HackClubAuthProvider = OAuthProvider<HackClubProfile, 'hackclub'> & {
  discover(): Promise<DiscoveryDocument>
}

const DEFAULT_SCOPES = ['openid', 'profile']
const ID_TOKEN_ALGORITHM = 'RS256'

export function createHackClubAuthProvider(options: HackClubAuthOptions): HackClubAuthProvider {
  let scopes = options.scopes ?? DEFAULT_SCOPES
  let discovered: Promise<Discovered> | undefined

  function discover(): Promise<Discovered> {
    discovered ??= loadDiscovery(options.issuer).catch((error) => {
      discovered = undefined
      throw error
    })
    return discovered
  }

  let provider = createOAuthProvider<HackClubProfile, 'hackclub'>('hackclub', {
    async createAuthorizationURL(transaction) {
      let { metadata } = await discover()
      let nonce = randomToken()
      transaction.providerState = JSON.stringify({ nonce } satisfies ProviderState)

      let url = new URL(metadata.authorization_endpoint)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('client_id', options.clientId)
      url.searchParams.set('redirect_uri', options.redirectUri)
      url.searchParams.set('scope', scopes.join(' '))
      url.searchParams.set('state', transaction.state)
      url.searchParams.set('nonce', nonce)
      if (options.pkce) {
        url.searchParams.set('code_challenge', await codeChallenge(transaction.codeVerifier))
        url.searchParams.set('code_challenge_method', 'S256')
      }
      return url
    },

    async handleCallback(context, transaction) {
      let { metadata, jwks } = await discover()
      let { nonce } = parseProviderState(transaction.providerState)

      let code = context.url.searchParams.get('code')
      if (!code) throw new LoginError('missing_code')

      let tokens = await exchangeCode(metadata, options, code, transaction.codeVerifier)
      let claims = await verifyIdToken(tokens.idToken, jwks, metadata.issuer, options.clientId)
      if (typeof claims.nonce !== 'string' || !timingSafeEqual(claims.nonce, nonce)) {
        throw new LoginError('nonce_mismatch')
      }

      let userinfo = await fetchUserinfo(metadata, tokens.accessToken)
      if (userinfo.sub !== claims.sub) throw new LoginError('userinfo_mismatch')

      let profile: HackClubProfile = {
        sub: claims.sub,
        name: stringClaim(userinfo.name) ?? stringClaim(claims.name),
        slackId: stringClaim(userinfo.slack_id) ?? stringClaim(claims.slack_id),
      }

      return {
        provider: 'hackclub',
        account: { provider: 'hackclub', providerAccountId: claims.sub },
        profile,
        tokens,
      }
    },
  })

  return Object.assign(provider, {
    async discover() {
      return (await discover()).metadata
    },
  })
}

async function loadDiscovery(issuer: string): Promise<Discovered> {
  let response: Response
  try {
    response = await fetch(new URL('/.well-known/openid-configuration', issuer), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new LoginError('discovery_failed', { cause: error })
  }
  if (!response.ok) throw new LoginError('discovery_failed')

  let metadata = (await response.json()) as Partial<DiscoveryDocument>
  if (metadata.issuer !== issuer) {
    throw new SafeError(`discovery issuer ${String(metadata.issuer)} does not match ${issuer}`)
  }
  for (let key of [
    'authorization_endpoint',
    'token_endpoint',
    'userinfo_endpoint',
    'jwks_uri',
  ] as const) {
    if (typeof metadata[key] !== 'string' || metadata[key].length === 0) {
      throw new SafeError(`discovery document is missing ${key}`)
    }
  }
  let algorithms = metadata.id_token_signing_alg_values_supported
  if (algorithms && !algorithms.includes(ID_TOKEN_ALGORITHM)) {
    throw new SafeError(`issuer does not sign id tokens with ${ID_TOKEN_ALGORITHM}`)
  }

  let complete = metadata as DiscoveryDocument
  return { metadata: complete, jwks: createRemoteJWKSet(new URL(complete.jwks_uri)) }
}

async function exchangeCode(
  metadata: DiscoveryDocument,
  options: HackClubAuthOptions,
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens & { idToken: string }> {
  let body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: options.redirectUri,
  })
  if (options.pkce) body.set('code_verifier', codeVerifier)

  let response: Response
  try {
    response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth(options.clientId, options.clientSecret),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new LoginError('token_exchange_failed', { cause: error })
  }
  if (!response.ok) throw new LoginError('token_exchange_failed')

  let json = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (
    json === null ||
    typeof json.access_token !== 'string' ||
    typeof json.id_token !== 'string' ||
    (typeof json.token_type === 'string' && json.token_type.toLowerCase() !== 'bearer')
  ) {
    throw new LoginError('invalid_token_response')
  }

  return { accessToken: json.access_token, idToken: json.id_token, tokenType: 'Bearer' }
}

async function verifyIdToken(
  idToken: string,
  jwks: Discovered['jwks'],
  issuer: string,
  clientId: string,
): Promise<JWTPayload & { sub: string }> {
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
      algorithms: [ID_TOKEN_ALGORITHM],
      requiredClaims: ['sub', 'iat', 'exp'],
      clockTolerance: 30,
    }))
  } catch (error) {
    throw new LoginError('id_token_invalid', { cause: error })
  }

  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== clientId) {
    throw new LoginError('id_token_invalid')
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new LoginError('id_token_invalid')
  }

  return payload as JWTPayload & { sub: string }
}

async function fetchUserinfo(metadata: DiscoveryDocument, accessToken: string) {
  let response: Response
  try {
    response = await fetch(metadata.userinfo_endpoint, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    throw new LoginError('userinfo_failed', { cause: error })
  }
  if (!response.ok) throw new LoginError('userinfo_failed')

  let json = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (json === null || typeof json.sub !== 'string') throw new LoginError('userinfo_failed')
  return json as Record<string, unknown> & { sub: string }
}

function parseProviderState(value: string | undefined): ProviderState {
  try {
    let parsed = JSON.parse(value ?? '') as Partial<ProviderState>
    if (typeof parsed.nonce === 'string' && parsed.nonce.length > 0) return { nonce: parsed.nonce }
  } catch {}
  throw new LoginError('invalid_transaction')
}

function stringClaim(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function basicAuth(clientId: string, clientSecret: string) {
  let encode = (value: string) => encodeURIComponent(value).replace(/%20/g, '+')
  return `Basic ${btoa(`${encode(clientId)}:${encode(clientSecret)}`)}`
}

async function codeChallenge(verifier: string) {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return Buffer.from(digest).toString('base64url')
}

function randomToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
}

function timingSafeEqual(a: string, b: string) {
  let left = new TextEncoder().encode(a)
  let right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index++) diff |= left[index]! ^ right[index]!
  return diff === 0
}
