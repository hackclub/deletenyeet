import { PgBoss } from 'pg-boss'

import { env } from '../env.ts'
import { logError } from '../log.ts'

export const QUEUES = {
  resolve: 'request-resolve',
  call: 'target-call',
  sweep: 'flow-sweep',
} as const

export const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: 4, schema: 'pgboss' })
boss.on('error', (error) => logError('job queue', error))

export async function enqueueResolve(requestId: string) {
  await boss.send(QUEUES.resolve, { requestId })
}

export async function enqueueCall(resultId: string, startAfter?: Date) {
  await boss.send(QUEUES.call, { resultId }, startAfter ? { startAfter } : undefined)
}
