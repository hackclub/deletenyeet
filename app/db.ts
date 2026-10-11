import { fileURLToPath } from 'node:url'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

import { env } from './env.ts'

export const db = createPostgresDatabase({ connectionString: env.DATABASE_URL, max: 10 })

const migrationsDirectory = fileURLToPath(new URL('../db/migrations/', import.meta.url))

export function loadAppMigrations() {
  return loadMigrations(migrationsDirectory)
}

export async function migrateDatabase() {
  await db.migrate(await loadAppMigrations())
}

export async function assertDatabaseCurrent() {
  let status = await db.migrationStatus(await loadAppMigrations())
  let outstanding = status.filter((entry) => entry.status !== 'applied')
  if (outstanding.length > 0) {
    let list = outstanding.map((entry) => `${entry.id}_${entry.name} (${entry.status})`).join(', ')
    throw new Error(`database schema is not current: ${list}. run \`npm run db -- migrate\``)
  }
}
