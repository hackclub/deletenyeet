import { createAssetServer } from 'remix/assets'
import { componentHmr } from 'remix/component-hmr/assets'

const dev = (process.env.NODE_ENV ?? 'development') === 'development'
const hmr = dev && !!process.env.REMIX_NODE_HMR

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  allowFiles: ['app/routes.ts', 'app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['app/**/*.test.*'],
  sourceMaps: dev ? 'external' : undefined,
  minify: !dev,
  watch: dev,
  hmr: hmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: { loaders: hmr ? [componentHmr()] : undefined },
})

export const scriptEntry = await assets.getScriptEntry('app/actions/public/entry.ts')
export const stylesheetHref = await assets.getHref('app/ui/public/app.css')
