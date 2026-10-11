import { createHash } from 'node:crypto'

import { sql, type Database } from 'remix/data-table'
import { createSession, type Session, type SessionStorage } from 'remix/session'

const hash = (id: string) => createHash('sha256').update(id).digest('hex')

export function createPostgresSessionStorage(
  db: Database,
  o: { ttlSeconds: number; staffSub(session: Session): string | null },
): SessionStorage {
  let drop = (id: string) => db.exec(sql`delete from sessions where id_hash = ${hash(id)}`)
  return {
    async read(cookie) {
      if (!cookie) return createSession()
      let r = await db.exec(
        sql`select data from sessions where id_hash = ${hash(cookie)} and expires_at > now()`,
      )
      let row = r.rows?.[0]
      return row
        ? createSession(cookie, row.data as Parameters<typeof createSession>[1])
        : createSession()
    },
    async save(s) {
      if (s.deleteId) await drop(s.deleteId)
      if (s.destroyed) {
        await drop(s.id)
        return ''
      }
      if (!s.dirty) return null
      await db.exec(sql`
        insert into sessions (id_hash, data, staff_sub, expires_at)
        values (
          ${hash(s.id)},
          ${JSON.stringify(s.data)}::jsonb,
          ${o.staffSub(s)},
          now() + make_interval(secs => ${o.ttlSeconds})
        )
        on conflict (id_hash) do update set
          data = excluded.data,
          staff_sub = excluded.staff_sub,
          expires_at = excluded.expires_at,
          updated_at = now()
      `)
      return s.id
    },
  }
}

export const pruneExpiredSessions = (db: Database) =>
  db.exec(sql`delete from sessions where expires_at <= now()`)
