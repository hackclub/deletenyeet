import { db } from '../db.ts'
import { resolveRequest, runTargetCall, sweep } from '../flow/flow.ts'
import { logError } from '../log.ts'
import { boss, QUEUES } from './boss.ts'

export async function startJobs() {
  await boss.start()
  for (let name of Object.values(QUEUES)) {
    await boss.createQueue(name, { retryLimit: 0, expireInSeconds: 300 })
  }

  await boss.work<{ requestId: string }>(QUEUES.resolve, async ([job]) => {
    if (!job) return
    try {
      await resolveRequest(db, job.data.requestId)
    } catch (error) {
      logError(`resolve ${job.data.requestId}`, error)
    }
  })

  await boss.work<{ resultId: string }>(QUEUES.call, { localConcurrency: 4 }, async ([job]) => {
    if (!job) return
    try {
      await runTargetCall(db, job.data.resultId)
    } catch (error) {
      logError(`target call result ${job.data.resultId}`, error)
    }
  })

  await boss.work(QUEUES.sweep, async () => {
    try {
      await sweep(db)
    } catch (error) {
      logError('sweep', error)
    }
  })
  await boss.schedule(QUEUES.sweep, '* * * * *')
}

export async function stopJobs() {
  await boss.stop({ graceful: true, timeout: 10_000 })
}
