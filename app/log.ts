export class SafeError extends Error {
  override name = 'SafeError'
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return `non-error thrown (${typeof error})`
  let { code } = error as { code?: unknown }
  let head = [error.name]
  if (typeof code === 'string') head.push(`code=${code}`)
  if (error instanceof SafeError) head.push(error.message)
  let frames = (error.stack ?? '').split('\n').filter((l) => l.trimStart().startsWith('at '))
  let d = [head.join(' '), ...frames].join('\n')
  return error.cause === undefined ? d : `${d}\ncaused by: ${describeError(error.cause)}`
}

export function logError(context: string, error: unknown) {
  console.error(`[error] ${context}: ${describeError(error)}`)
}
