import type { Database } from 'remix/data-table'

import { requestIdentifiers } from '../data/tables.ts'
import type { Subject } from '../targets/types.ts'

export async function loadSubject(db: Database, requestId: string): Promise<Subject> {
  let rows = await db.findMany(requestIdentifiers, {
    where: { request_id: requestId, hashed: false },
    orderBy: ['id', 'asc'],
  })
  return {
    emails: rows.filter((row) => row.kind === 'email').map((row) => row.value),
    slack_id: rows.find((row) => row.kind === 'slack_id')?.value ?? null,
    identity_id: rows.find((row) => row.kind === 'identity_id')?.value ?? null,
  }
}
