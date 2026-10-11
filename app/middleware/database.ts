import type { Database } from 'remix/data-table'
import { createContextKey, type Middleware } from 'remix/router'

import { db } from '../db.ts'

const key = createContextKey<Database>()

export const loadDatabase =
  (): Middleware<{ key: typeof key; value: Database; property: 'db' }> => (context, next) => {
    context.set(key, db, { property: 'db' })
    return next()
  }
