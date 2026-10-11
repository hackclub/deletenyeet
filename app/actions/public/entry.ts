import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

const app = run({
  async loadModule(url, name) {
    let C = (await importModule(url))[name]
    if (typeof C !== 'function') throw new Error(`Unknown component: ${url}#${name}`)
    return C
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})

// Restore the feedback element after document reconciliation.
const status = document.createElement('div')
status.className = 'navigation-status'
status.setAttribute('role', 'status')
status.setAttribute('aria-live', 'polite')
status.hidden = true
document.body.append(status)

app.frames.top.addEventListener('reloadStart', () => {
  if (!status.isConnected) document.body.append(status)
  status.textContent = 'Loading…'
  status.hidden = false
  document.querySelector('main')?.setAttribute('aria-busy', 'true')
})
app.frames.top.addEventListener('reloadComplete', () => {
  if (!status.isConnected) document.body.append(status)
  if (status.textContent === 'Loading…') status.hidden = true
  document.querySelector('main')?.removeAttribute('aria-busy')
  const menu = document.querySelector<HTMLInputElement>('#app-nav-toggle')
  if (menu) menu.checked = false
})
app.addEventListener('error', () => {
  if (!status.isConnected) document.body.append(status)
  status.replaceChildren(document.createTextNode('Could not load this page. '))
  const retry = document.createElement('a')
  retry.href = window.location.href
  retry.setAttribute('data-rmx-document', '')
  retry.textContent = 'Reload page'
  status.append(retry)
  status.hidden = false
})

import.meta.hot?.on('server:update', async () => {
  try {
    await app.ready()
    await app.frames.top.reload()
  } catch (e) {
    console.error('Error reloading top frame on server update', e)
  }
})
