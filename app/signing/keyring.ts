import { readFile } from 'node:fs/promises'

import { calculateJwkThumbprint, exportJWK, generateKeyPair, importJWK, type JWK } from 'jose'

import type { Env } from '../env.ts'
import { SafeError } from '../log.ts'

export const SIGNING_ALG = 'ES256'

type PublicJwk = {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
  kid: string
  alg: typeof SIGNING_ALG
  use: 'sig'
}
type SigningJwk = JWK & { kid: string; x: string; y: string }

export interface Keyring {
  activeKid: string
  signingKey: CryptoKey
  publicKeys: PublicJwk[]
}

class SigningKeyError extends SafeError {
  override name = 'SigningKeyError'
}

function fail(m: string): never {
  throw new SigningKeyError(`signing keys: ${m}`)
}

export async function loadKeyring(
  e: Pick<Env, 'SIGNING_KEYS' | 'SIGNING_KEYS_FILE' | 'NODE_ENV'>,
): Promise<Keyring> {
  if (e.SIGNING_KEYS) return parseKeyring(e.SIGNING_KEYS)
  if (e.SIGNING_KEYS_FILE)
    return parseKeyring(
      await readFile(e.SIGNING_KEYS_FILE, 'utf8').catch(() =>
        fail('SIGNING_KEYS_FILE could not be read'),
      ),
    )
  if (e.NODE_ENV !== 'development') fail('SIGNING_KEYS or SIGNING_KEYS_FILE is required')
  let k = await generateSigningJwk()
  let ring = await parseKeyring(JSON.stringify({ active: k.kid, keys: [k] }))
  console.warn(`signing keys: none configured, using ephemeral development key ${ring.activeKid}`)
  return ring
}

async function parseKeyring(text: string): Promise<Keyring> {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    fail('not valid JSON')
  }
  if (!isRecord(doc) || typeof doc.active !== 'string' || !Array.isArray(doc.keys))
    fail('expected {"active": "<kid>", "keys": [<jwk>, ...]}')

  let pub: PublicJwk[] = []
  let priv = new Map<string, SigningJwk>()
  for (let [i, entry] of doc.keys.entries()) {
    let jwk = readJwk(entry, i)
    if (pub.some((k) => k.kid === jwk.kid)) fail(`duplicate kid ${jwk.kid}`)
    pub.push(toPublic(jwk))
    if (jwk.d !== undefined) priv.set(jwk.kid, jwk)
  }

  let active = doc.active
  if (!pub.some((k) => k.kid === active)) fail(`active kid ${active} is not in keys`)
  let jwk = priv.get(active) ?? fail(`active kid ${active} has no private key`)
  for (let [kid, j] of priv) await assertPairMatches(kid, j)
  return { activeKid: active, signingKey: await importPrivate(active, jwk), publicKeys: pub }
}

export async function generateSigningJwk() {
  let jwk = await exportJWK((await generateKeyPair(SIGNING_ALG, { extractable: true })).privateKey)
  let thumb = await calculateJwkThumbprint(jwk)
  return {
    ...jwk,
    kid: `${new Date().toISOString().slice(0, 10)}-${thumb.slice(0, 8)}`,
    alg: SIGNING_ALG,
    use: 'sig',
  }
}

function readJwk(e: unknown, i: number): SigningJwk {
  let at = `keys[${i}]`
  if (!isRecord(e)) fail(`${at} is not an object`)
  if (typeof e.kid !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(e.kid))
    fail(`${at} needs a kid of 1 to 64 letters, digits, dot, dash, or underscore`)
  at += ` (${e.kid})`
  if (e.kty !== 'EC' || e.crv !== 'P-256') fail(`${at} must be an EC P-256 key`)
  if (typeof e.x !== 'string' || typeof e.y !== 'string') fail(`${at} is missing x or y`)
  if (e.d !== undefined && typeof e.d !== 'string') fail(`${at} has an invalid d`)
  if (e.alg !== undefined && e.alg !== SIGNING_ALG) fail(`${at} alg must be ES256`)
  if (e.use !== undefined && e.use !== 'sig') fail(`${at} use must be sig`)
  return e as SigningJwk
}

const toPublic = ({ x, y, kid }: SigningJwk): PublicJwk => ({
  kty: 'EC',
  crv: 'P-256',
  x,
  y,
  kid,
  alg: SIGNING_ALG,
  use: 'sig',
})

async function importPrivate(kid: string, jwk: JWK) {
  let key = await importJWK({ ...jwk, ext: false }, SIGNING_ALG, { extractable: false }).catch(
    () => null,
  )
  if (!(key instanceof CryptoKey) || key.type !== 'private')
    fail(`${kid} private key could not be imported or does not match its x and y`)
  return key
}

async function assertPairMatches(kid: string, jwk: SigningJwk) {
  let priv = await importPrivate(kid, jwk)
  let pub = (await importJWK(toPublic(jwk), SIGNING_ALG).catch(() =>
    fail(`${kid} public key could not be imported`),
  )) as CryptoKey
  let probe = new TextEncoder().encode(`keyring probe ${kid}`)
  let alg = { name: 'ECDSA', hash: 'SHA-256' }
  if (!(await crypto.subtle.verify(alg, pub, await crypto.subtle.sign(alg, priv, probe), probe)))
    fail(`${kid} private key does not match its x and y`)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
