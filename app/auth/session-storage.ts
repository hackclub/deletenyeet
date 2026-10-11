import { sql, type Database } from 'remix/data-table'
import { createSession, type Session, type SessionStorage } from 'remix/session'

export interface PostgresSessionStorageOptions {
  ttlSeconds: number
  staffSub?(session: Session): string | null
}

export function createPostgresSessionStorage(
  db: Database,
  options: PostgresSessionStorageOptions,
): SessionStorage {
  return {
    async read(cookie) {
      if (cookie) {
        let result = await db.exec(sql`
          select data from sessions
          where id_hash = ${await hashId(cookie)} and expires_at > now()
        `)
        let row = result.rows?.[0]
        if (row) return createSession(cookie, row.data as Parameters<typeof createSession>[1])
      }

      return createSession()
    },
    async save(session) {
      if (session.deleteId) {
        await deleteSession(db, session.deleteId)
      }

      if (session.destroyed) {
        await deleteSession(db, session.id)
        return ''
      }

      if (!session.dirty) return null

      await db.exec(sql`
        insert into sessions (id_hash, data, staff_sub, expires_at)
        values (
          ${await hashId(session.id)},
          ${JSON.stringify(session.data)}::jsonb,
          ${options.staffSub?.(session) ?? null},
          now() + make_interval(secs => ${options.ttlSeconds})
        )
        on conflict (id_hash) do update set
          data = excluded.data,
          staff_sub = excluded.staff_sub,
          expires_at = excluded.expires_at,
          updated_at = now()
      `)
      return session.id
    },
  }
}

export async function pruneExpiredSessions(db: Database): Promise<number> {
  let result = await db.exec(sql`delete from sessions where expires_at <= now()`)
  return result.affectedRows ?? 0
}

async function deleteSession(db: Database, id: string) {
  await db.exec(sql`delete from sessions where id_hash = ${await hashId(id)}`)
}

async function hashId(id: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id))
  return Buffer.from(digest).toString('hex')
}
