import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { scriptEntry, stylesheetHref } from '../assets.ts'

const FONT = 'https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;700&display=swap'

export function Document(
  handle: Handle<{ children?: RemixNode; head?: RemixNode; title?: string }>,
) {
  return () => {
    let { children, head, title = 'Privacy request hub' } = handle.props
    let { href, importMap, preloads } = scriptEntry
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" href="/favicon.png" type="image/png" />
          <title>{title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={FONT} />
          <link rel="stylesheet" href={stylesheetHref} />
          {head}
          <ImportMap value={importMap} />
          {preloads.map((p) => (
            <link key={p} rel="modulepreload" href={p} />
          ))}
          <script type="module" src={href}></script>
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
