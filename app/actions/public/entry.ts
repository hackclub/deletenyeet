import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'
import { run } from 'remix/component'

// keep every link and form a document navigation so redirects to other origins like the
// oidc provider work and the app behaves the same with or without javascript
window.navigation?.addEventListener('navigate', (e) => e.stopImmediatePropagation())

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

import.meta.hot?.on('server:update', async () => {
  try {
    await app.ready()
    await app.frames.top.reload()
  } catch (e) {
    console.error('Error reloading top frame on server update', e)
  }
})
