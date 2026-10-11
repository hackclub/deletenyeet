import { createCookie } from 'remix/cookie'
import { createSessionAuthScheme } from 'remix/middleware/auth'
import type { Session } from 'remix/session'

import { db } from '../db.ts'
import { env } from '../env.ts'
import { routes } from '../routes.ts'
import { createHackClubAuthProvider, type HackClubProfile } from './hackclub-provider.ts'
import { createPostgresSessionStorage } from './session-storage.ts'

export type Staff = HackClubProfile

const KEY = 'staff'
const TTL = 12 * 60 * 60
const secure = env.APP_ORIGIN.startsWith('https:')
const allowlist = new Set(env.STAFF_SUBS)

export const hackClubAuth = createHackClubAuthProvider({
  issuer: env.HCA_ISSUER,
  clientId: env.HCA_CLIENT_ID,
  clientSecret: env.HCA_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.callback.href(), env.APP_ORIGIN).href,
  pkce: env.HCA_PKCE,
})

export const sessionCookie = createCookie(secure ? '__Host-session' : 'session', {
  secrets: [env.SESSION_SECRET],
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: '/',
  maxAge: TTL,
})

export const sessionStorage = createPostgresSessionStorage(db, {
  ttlSeconds: TTL,
  staffSub: (s) => readStaff(s)?.sub ?? null,
})

export const isAllowlisted = (sub: string) => allowlist.has(sub)

export const writeStaff = (s: Session, staff: Staff) => s.set(KEY, staff)

function readStaff(s: Session): Staff | null {
  let v = s.get(KEY) as Staff | undefined
  return v && typeof v.sub === 'string' ? v : null
}

export const staffSessionScheme = createSessionAuthScheme<Staff, Staff>({
  name: 'session',
  read: readStaff,
  verify: (s) => (isAllowlisted(s.sub) ? s : null),
  invalidate: (s) => s.unset(KEY),
})
