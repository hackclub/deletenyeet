import { readFile } from 'node:fs/promises'

import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, type JWK } from 'jose'

import { SafeError } from '../log.ts'

export const SIGNING_ALG = 'ES256'

export interface PublicSigningJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
  kid: string
  alg: typeof SIGNING_ALG
  use: 'sig'
}

export interface Keyring {
  activeKid: string
  signingKey: CryptoKey
  publicKeys: PublicSigningJwk[]
}

export class SigningKeyError extends SafeError {
  constructor(message: string) {
    super(`signing keys: ${message}`)
    this.name = 'SigningKeyError'
  }
}

export interface KeyringSource {
  SIGNING_KEYS?: string | undefined
  SIGNING_KEYS_FILE?: string | undefined
  NODE_ENV: 'development' | 'production'
}

export async function loadKeyring(source: KeyringSource): Promise<Keyring> {
  if (source.SIGNING_KEYS) return parseKeyring(source.SIGNING_KEYS)
  if (source.SIGNING_KEYS_FILE) {
    let text: string
    try {
      text = await readFile(source.SIGNING_KEYS_FILE, 'utf8')
    } catch {
      throw new SigningKeyError('SIGNING_KEYS_FILE could not be read')
    }
    return parseKeyring(text)
  }
  if (source.NODE_ENV === 'development') {
    let keyring = await createEphemeralKeyring()
    console.warn(
      `signing keys: none configured, using ephemeral development key ${keyring.activeKid}`,
    )
    return keyring
  }
  throw new SigningKeyError('SIGNING_KEYS or SIGNING_KEYS_FILE is required')
}

export async function parseKeyring(text: string): Promise<Keyring> {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    throw new SigningKeyError('not valid JSON')
  }
  if (!isRecord(document) || typeof document.active !== 'string' || !Array.isArray(document.keys)) {
    throw new SigningKeyError('expected {"active": "<kid>", "keys": [<jwk>, ...]}')
  }

  let publicKeys: PublicSigningJwk[] = []
  let privateJwks = new Map<string, SigningJwk>()
  for (let [index, entry] of document.keys.entries()) {
    let jwk = readJwk(entry, index)
    if (publicKeys.some((key) => key.kid === jwk.kid)) {
      throw new SigningKeyError(`duplicate kid ${jwk.kid}`)
    }
    publicKeys.push(toPublicJwk(jwk))
    if (jwk.d !== undefined) privateJwks.set(jwk.kid, jwk)
  }

  let activeKid = document.active
  if (!publicKeys.some((key) => key.kid === activeKid)) {
    throw new SigningKeyError(`active kid ${activeKid} is not in keys`)
  }
  let activeJwk = privateJwks.get(activeKid)
  if (!activeJwk) {
    throw new SigningKeyError(`active kid ${activeKid} has no private key`)
  }

  for (let [kid, jwk] of privateJwks) {
    await assertPairMatches(kid, jwk)
  }

  let signingKey = await importPrivate(activeKid, activeJwk)
  return { activeKid, signingKey, publicKeys }
}

export async function generateSigningJwk(now = new Date()): Promise<JWK & { kid: string }> {
  let { privateKey } = await generateKeyPair(SIGNING_ALG, { extractable: true })
  let jwk = await exportJWK(privateKey)
  let thumbprint = await calculateJwkThumbprint(jwk)
  return {
    ...jwk,
    kid: `${now.toISOString().slice(0, 10)}-${thumbprint.slice(0, 8)}`,
    alg: SIGNING_ALG,
    use: 'sig',
  }
}

async function createEphemeralKeyring(): Promise<Keyring> {
  let jwk = await generateSigningJwk()
  return parseKeyring(JSON.stringify({ active: jwk.kid, keys: [jwk] }))
}

type SigningJwk = JWK & { kid: string; x: string; y: string }

function readJwk(entry: unknown, index: number): SigningJwk {
  let where = `keys[${index}]`
  if (!isRecord(entry)) throw new SigningKeyError(`${where} is not an object`)
  if (typeof entry.kid !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(entry.kid)) {
    throw new SigningKeyError(
      `${where} needs a kid of 1 to 64 letters, digits, dot, dash, or underscore`,
    )
  }
  let label = `${where} (${entry.kid})`
  if (entry.kty !== 'EC' || entry.crv !== 'P-256')
    throw new SigningKeyError(`${label} must be an EC P-256 key`)
  if (typeof entry.x !== 'string' || typeof entry.y !== 'string') {
    throw new SigningKeyError(`${label} is missing x or y`)
  }
  if (entry.d !== undefined && typeof entry.d !== 'string')
    throw new SigningKeyError(`${label} has an invalid d`)
  if (entry.alg !== undefined && entry.alg !== SIGNING_ALG)
    throw new SigningKeyError(`${label} alg must be ES256`)
  if (entry.use !== undefined && entry.use !== 'sig')
    throw new SigningKeyError(`${label} use must be sig`)
  return entry as SigningJwk
}

function toPublicJwk(jwk: SigningJwk): PublicSigningJwk {
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, kid: jwk.kid, alg: SIGNING_ALG, use: 'sig' }
}

async function importPrivate(kid: string, jwk: JWK): Promise<CryptoKey> {
  try {
    let key = await importJWK({ ...jwk, ext: false }, SIGNING_ALG, { extractable: false })
    if (!(key instanceof CryptoKey) || key.type !== 'private') throw new Error()
    return key
  } catch {
    throw new SigningKeyError(
      `${kid} private key could not be imported or does not match its x and y`,
    )
  }
}

async function assertPairMatches(kid: string, jwk: SigningJwk) {
  let privateKey = await importPrivate(kid, jwk)
  let publicKey: CryptoKey
  try {
    publicKey = (await importJWK(toPublicJwk(jwk), SIGNING_ALG)) as CryptoKey
  } catch {
    throw new SigningKeyError(`${kid} public key could not be imported`)
  }
  let probe = new TextEncoder().encode(`keyring probe ${kid}`)
  let algorithm = { name: 'ECDSA', hash: 'SHA-256' }
  let signature = await crypto.subtle.sign(algorithm, privateKey, probe)
  if (!(await crypto.subtle.verify(algorithm, publicKey, signature, probe))) {
    throw new SigningKeyError(`${kid} private key does not match its x and y`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
