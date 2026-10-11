export class SafeError extends Error {
  override name = 'SafeError'
}

export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return `non-error thrown (${typeof error})`

  let parts = [error.name]
  let code = (error as { code?: unknown }).code
  if (typeof code === 'string') parts.push(`code=${code}`)
  if (error instanceof SafeError) parts.push(error.message)

  let frames = (error.stack ?? '').split('\n').filter((line) => line.trimStart().startsWith('at '))
  let description = [parts.join(' '), ...frames].join('\n')

  return error.cause === undefined
    ? description
    : `${description}\ncaused by: ${describeError(error.cause)}`
}

export function logError(context: string, error: unknown) {
  console.error(`[error] ${context}: ${describeError(error)}`)
}
