import { env } from '../env.ts'
import { loadKeyring } from './keyring.ts'

export const keyring = await loadKeyring(env)
