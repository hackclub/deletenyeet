import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'

const port = coerce
  .number()
  .refine((v) => Number.isInteger(v) && v > 0 && v < 65536, 'must be a TCP port')

const url = (protocols: string[], message: string, ok?: (u: URL) => boolean) =>
  s.string().refine((v) => {
    let u = URL.parse(v)
    return !!u && protocols.includes(u.protocol) && (ok?.(u) ?? true)
  }, message)

const httpOrigin = url(['https:', 'http:'], 'must be an http:// or https:// URL').transform(
  (v) => new URL(v).origin,
)
const required = s.string().pipe(checks.minLength(1))
const flag = (fallback: 'true' | 'false') =>
  s.defaulted(s.enum_(['true', 'false']), fallback).transform((v) => v === 'true')

const EnvSchema = s.object({
  NODE_ENV: s.enum_(['development', 'production']),
  PORT: s.defaulted(port, 44100),
  DATABASE_URL: url(
    ['postgres:', 'postgresql:'],
    'must be a postgres:// URL that names a database',
    (u) => u.pathname.length > 1,
  ),
  APP_ORIGIN: httpOrigin,
  SESSION_SECRET: s.string().pipe(checks.minLength(32)),
  HCA_ISSUER: s.defaulted(httpOrigin, 'https://auth.hackclub.com'),
  HCA_CLIENT_ID: required,
  HCA_CLIENT_SECRET: required,
  HCA_PKCE: flag('true'),
  STAFF_SUBS: s.defaulted(s.string(), '').transform((v) =>
    v
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  ),
  MIGRATE_ON_START: flag('false'),
  FAKE_TARGET_PORT: s.defaulted(port, 44199),
  SIGNING_KEYS: s.optional(required),
  SIGNING_KEYS_FILE: s.optional(required),
})

export type Env = s.InferOutput<typeof EnvSchema>

const invalid = (problems: string[]) =>
  new Error(`invalid environment:\n${problems.map((p) => `  ${p}`).join('\n')}`)

function parseEnv(source: Record<string, string | undefined>): Env {
  let r = s.parseSafe(EnvSchema, source)
  if (!r.success)
    throw invalid(
      r.issues.map(
        (i) =>
          `${i.path?.map((p) => String(typeof p === 'object' ? p.key : p)).join('.') ?? '(root)'}: ${i.message}`,
      ),
    )

  let e = r.value
  let prod = e.NODE_ENV === 'production'
  let problems = (
    [
      [prod && !e.APP_ORIGIN.startsWith('https:'), 'APP_ORIGIN: must be https in production'],
      [prod && !e.HCA_ISSUER.startsWith('https:'), 'HCA_ISSUER: must be https in production'],
      [prod && !e.STAFF_SUBS.length, 'STAFF_SUBS: must list at least one sub in production'],
      [
        prod && !e.SIGNING_KEYS && !e.SIGNING_KEYS_FILE,
        'SIGNING_KEYS or SIGNING_KEYS_FILE: required in production',
      ],
      [
        !!e.SIGNING_KEYS && !!e.SIGNING_KEYS_FILE,
        'SIGNING_KEYS and SIGNING_KEYS_FILE: set only one',
      ],
    ] as [boolean, string][]
  )
    .filter(([bad]) => bad)
    .map(([, m]) => m)
  if (problems.length) throw invalid(problems)
  return e
}

export const env = parseEnv(process.env)
