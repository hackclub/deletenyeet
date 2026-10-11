import { createCookie } from 'remix/cookie'
import { createSessionAuthScheme } from 'remix/middleware/auth'
import type { Session } from 'remix/session'

import { db } from '../db.ts'
import { env } from '../env.ts'
import { routes } from '../routes.ts'
import { createHackClubAuthProvider } from './hackclub-provider.ts'
import { createPostgresSessionStorage } from './session-storage.ts'

export interface Staff {
  sub: string
  name: string | null
  slackId: string | null
}

const STAFF_KEY = 'staff'
const SESSION_TTL_SECONDS = 12 * 60 * 60

export const hackClubAuth = createHackClubAuthProvider({
  issuer: env.HCA_ISSUER,
  clientId: env.HCA_CLIENT_ID,
  clientSecret: env.HCA_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.callback.href(), env.APP_ORIGIN).href,
  pkce: env.HCA_PKCE,
})

const secureOrigin = env.APP_ORIGIN.startsWith('https:')

export const sessionCookie = createCookie(secureOrigin ? '__Host-session' : 'session', {
  secrets: [env.SESSION_SECRET],
  httpOnly: true,
  secure: secureOrigin,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
})

export const sessionStorage = createPostgresSessionStorage(db, {
  ttlSeconds: SESSION_TTL_SECONDS,
  staffSub: (session) => readStaff(session)?.sub ?? null,
})

const allowlist = new Set(env.STAFF_SUBS)

export function isAllowlisted(sub: string): boolean {
  return allowlist.has(sub)
}

export function writeStaff(session: Session, staff: Staff) {
  session.set(STAFF_KEY, staff)
}

export function readStaff(session: Session): Staff | null {
  let value = session.get(STAFF_KEY) as Staff | undefined
  return value && typeof value.sub === 'string' ? value : null
}

export const staffSessionScheme = createSessionAuthScheme<Staff, Staff>({
  name: 'session',
  read: readStaff,
  verify: (staff) => (isAllowlisted(staff.sub) ? staff : null),
  invalidate(session) {
    session.unset(STAFF_KEY)
  },
})
