import { db } from '../db.ts'
import { resolveRequest, runTargetCall, sweep } from '../flow/flow.ts'
import { logError } from '../log.ts'
import { boss, QUEUES } from './boss.ts'

async function guard(context: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    logError(context, error)
  }
}

export async function startJobs() {
  await boss.start()
  for (let name of Object.values(QUEUES))
    await boss.createQueue(name, { retryLimit: 0, expireInSeconds: 300 })

  await boss.work<{ requestId: string }>(QUEUES.resolve, async ([j]) => {
    if (j) await guard(`resolve ${j.data.requestId}`, () => resolveRequest(db, j.data.requestId))
  })
  await boss.work<{ resultId: string }>(QUEUES.call, { localConcurrency: 4 }, async ([j]) => {
    if (j)
      await guard(`target call result ${j.data.resultId}`, () => runTargetCall(db, j.data.resultId))
  })
  await boss.work(QUEUES.sweep, () => guard('sweep', () => sweep(db)))
  await boss.schedule(QUEUES.sweep, '* * * * *')
}

export async function stopJobs() {
  await boss.stop({ graceful: true, timeout: 10_000 })
}
