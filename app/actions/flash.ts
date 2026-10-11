import type { Session } from 'remix/session'

import type { FlashItem } from '../ui/flashbar.tsx'

const FLASH_KEY = 'flash'

interface StoredFlash {
  type: FlashItem['type']
  header: string
  content?: string
}

export function setFlash(session: Session, flash: StoredFlash) {
  session.flash(FLASH_KEY, flash)
}

export function takeFlashes(session: Session): FlashItem[] {
  let flash = session.get(FLASH_KEY) as StoredFlash | undefined
  if (!flash) return []
  return [{ id: 'flash', type: flash.type, header: flash.header, content: flash.content, dismissible: true }]
}
