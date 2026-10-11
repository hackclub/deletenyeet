import type { Target as Row } from '../data/tables.ts'
import { createEndpointTarget, readEndpointConfig } from './endpoint.ts'
import { TargetCallError, type Target } from './types.ts'

export function buildTarget(row: Row): Target {
  if (row.type !== 'endpoint') throw new TargetCallError('unsupported_type', false)
  let config = readEndpointConfig(row.config)
  if (!config || !row.audience) throw new TargetCallError('misconfigured', false)
  return createEndpointTarget({ slug: row.slug, audience: row.audience, config })
}
