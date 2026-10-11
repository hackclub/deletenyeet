import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'

const port = coerce
  .number()
  .refine((value) => Number.isInteger(value) && value > 0 && value < 65536, 'must be a TCP port')

const postgresUrl = s.string().refine((value) => {
  let url = parseUrl(value)
  return (
    url !== null &&
    (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
    url.pathname.length > 1
  )
}, 'must be a postgres:// URL that names a database')

const httpOrigin = s
  .string()
  .refine((value) => {
    let url = parseUrl(value)
    return url !== null && (url.protocol === 'https:' || url.protocol === 'http:')
  }, 'must be an http:// or https:// URL')
  .transform((value) => new URL(value).origin)

const required = s.string().pipe(checks.minLength(1))

const flag = (fallback: 'true' | 'false') =>
  s.defaulted(s.enum_(['true', 'false']), fallback).transform((value) => value === 'true')

const subList = s.defaulted(s.string(), '').transform((value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0),
)

const EnvSchema = s.object({
  NODE_ENV: s.enum_(['development', 'production']),
  PORT: s.defaulted(port, 44100),
  DATABASE_URL: postgresUrl,
  APP_ORIGIN: httpOrigin,
  SESSION_SECRET: s.string().pipe(checks.minLength(32)),
  HCA_ISSUER: s.defaulted(httpOrigin, 'https://auth.hackclub.com'),
  HCA_CLIENT_ID: required,
  HCA_CLIENT_SECRET: required,
  HCA_PKCE: flag('true'),
  STAFF_SUBS: subList,
  MIGRATE_ON_START: flag('false'),
  FAKE_TARGET_PORT: s.defaulted(port, 44199),
  SIGNING_KEYS: s.optional(required),
  SIGNING_KEYS_FILE: s.optional(required),
})

export type Env = s.InferOutput<typeof EnvSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
  let result = s.parseSafe(EnvSchema, source)
  if (!result.success) {
    let problems = result.issues.map((issue) => {
      let key = issue.path
        ?.map((segment) => String(typeof segment === 'object' ? segment.key : segment))
        .join('.')
      return `${key ?? '(root)'}: ${issue.message}`
    })
    throw invalid(problems)
  }

  let env = result.value
  let problems: string[] = []

  if (env.NODE_ENV === 'production') {
    if (!env.APP_ORIGIN.startsWith('https:')) problems.push('APP_ORIGIN: must be https in production')
    if (!env.HCA_ISSUER.startsWith('https:')) problems.push('HCA_ISSUER: must be https in production')
    if (env.STAFF_SUBS.length === 0) problems.push('STAFF_SUBS: must list at least one sub in production')
    if (!env.SIGNING_KEYS && !env.SIGNING_KEYS_FILE) {
      problems.push('SIGNING_KEYS or SIGNING_KEYS_FILE: required in production')
    }
  }

  if (env.SIGNING_KEYS && env.SIGNING_KEYS_FILE) {
    problems.push('SIGNING_KEYS and SIGNING_KEYS_FILE: set only one')
  }

  if (problems.length > 0) throw invalid(problems)
  return env
}

function invalid(problems: string[]) {
  return new Error(`invalid environment:\n${problems.map((problem) => `  ${problem}`).join('\n')}`)
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export const env = parseEnv(process.env)
