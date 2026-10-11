import type { Handle, RemixNode } from 'remix/component'

export function Prose(handle: Handle<{ children: RemixNode }>) {
  return () => <div class="prose">{handle.props.children}</div>
}

export type CodeLanguage = 'js' | 'json' | 'sql' | 'text'

const STRING = String.raw`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"`
const NUMBER = String.raw`\b\d+(?:\.\d+)?\b`

const GRAMMARS: Record<Exclude<CodeLanguage, 'text'>, RegExp> = {
  js: new RegExp(
    [
      String.raw`(?<comment>\/\/.*|\/\*[\s\S]*?\*\/)`,
      String.raw`(?<string>${STRING}|\x60(?:\\.|[^\x60\\])*\x60)`,
      String.raw`(?<keyword>\b(?:import|from|export|default|async|await|function|let|const|var|if|else|return|throw|new|typeof|try|catch)\b)`,
      String.raw`(?<literal>\b(?:true|false|null|undefined)\b)`,
      String.raw`(?<number>${NUMBER})`,
    ].join('|'),
    'g',
  ),
  json: new RegExp(
    [
      String.raw`(?<comment>\/\/.*)`,
      String.raw`(?<property>"(?:\\.|[^"\\\n])*"(?=\s*:))`,
      String.raw`(?<string>${STRING})`,
      String.raw`(?<literal>\b(?:true|false|null)\b)`,
      String.raw`(?<number>${NUMBER})`,
    ].join('|'),
    'g',
  ),
  sql: new RegExp(
    [
      String.raw`(?<comment>--.*)`,
      String.raw`(?<string>${STRING})`,
      String.raw`(?<keyword>\b(?:create|table|primary|key|not|null|default|insert|into|values|on|conflict|do|nothing|delete|from|where|interval|select|update|set|and|or)\b)`,
      String.raw`(?<number>${NUMBER})`,
    ].join('|'),
    'gi',
  ),
}

function highlight(code: string, language: CodeLanguage): RemixNode {
  if (language === 'text') return code
  let out: RemixNode[] = []
  let at = 0
  for (let m of code.matchAll(GRAMMARS[language])) {
    let kind = Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined)?.[0]
    if (m.index > at) out.push(code.slice(at, m.index))
    out.push(<span class={`code-token code-token--${kind}`}>{m[0]}</span>)
    at = m.index + m[0].length
  }
  out.push(code.slice(at))
  return out
}

export function CodeBlock(
  handle: Handle<{ children: string; language?: CodeLanguage; label?: string; wrap?: boolean }>,
) {
  return () => {
    let { children, language = 'text', label, wrap } = handle.props
    return (
      <figure class="code-block">
        {label ? <figcaption class="code-block__label">{label}</figcaption> : null}
        <pre class={wrap ? 'code-block__body code-block__body--wrap' : 'code-block__body'}>
          <code>{highlight(children, language)}</code>
        </pre>
      </figure>
    )
  }
}
