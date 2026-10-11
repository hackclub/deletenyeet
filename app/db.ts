import { fileURLToPath } from 'node:url'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

import { env } from './env.ts'

export const db = createPostgresDatabase({ connectionString: env.DATABASE_URL, max: 10 })

let migrations = () => loadMigrations(fileURLToPath(new URL('../db/migrations/', import.meta.url)))

export async function migrateDatabase() {
  await db.migrate(await migrations())
}

export async function assertDatabaseCurrent() {
  let pending = (await db.migrationStatus(await migrations())).filter((m) => m.status !== 'applied')
  if (pending.length)
    throw new Error(
      `database schema is not current: ${pending.map((m) => `${m.id}_${m.name} (${m.status})`).join(', ')}. run \`npm run db -- migrate\``,
    )
}
