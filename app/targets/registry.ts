import type { Target as TargetRow } from '../data/tables.ts'
import { createEndpointTarget, readEndpointConfig } from './endpoint.ts'
import { TargetCallError, type Target } from './types.ts'

export function buildTarget(row: TargetRow): Target {
  if (row.type === 'endpoint') {
    let config = readEndpointConfig(row.config)
    if (!config || !row.audience) throw new TargetCallError('misconfigured', false)
    return createEndpointTarget({ slug: row.slug, audience: row.audience, config })
  }
  throw new TargetCallError('unsupported_type', false)
}
