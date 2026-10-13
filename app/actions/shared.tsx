import type { Handle, RemixNode } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import type { Session } from 'remix/session'

import type { Staff } from '../auth/staff.ts'
import type { AppContext } from '../router.ts'
import { Alert } from '../ui/alert.tsx'
import { Button } from '../ui/button.tsx'
import type { FlashItem } from '../ui/flashbar.tsx'
import { FormField, Input } from '../ui/form-field.tsx'
import { SpaceBetween } from '../ui/space-between.tsx'
import { StaffPage } from '../ui/staff-page.tsx'

export type Flash = { type: FlashItem['type']; header: string; content?: string }
export type Errors<T> = Partial<Record<keyof T, string>>
export type PageBase = { staff: Staff; csrfToken: string; flashes: FlashItem[] }

export let notFound = () => new Response('Not Found', { status: 404 })
export let setFlash = (s: Session, f: Flash) => s.flash('flash', f)
export let fields = (form?: FormData) => (n: string) => String(form?.get(n) ?? '').trim()
export let plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export function page(c: AppContext, staff: Staff, flashes = true): PageBase {
  let f = flashes && (c.session.get('flash') as Flash | undefined)
  return {
    staff,
    csrfToken: getCsrfToken(c),
    flashes: f ? [{ ...f, id: 'flash', dismissible: true }] : [],
  }
}

export function Page(
  handle: Handle<{
    base: PageBase
    title: string
    section: [string, string]
    crumb?: [string, string]
    refresh?: number
    children: RemixNode
  }>,
) {
  return () => {
    let { base, title, section, crumb, refresh, children } = handle.props
    let [text, href] = section
    return (
      <StaffPage
        {...base}
        title={title}
        activeHref={href}
        refreshSeconds={refresh}
        breadcrumbs={
          crumb && [
            { text, href },
            { text: crumb[0], href: crumb[1] },
          ]
        }
      >
        {children}
      </StaffPage>
    )
  }
}

export function Post(handle: Handle<{ action: string; csrf: string; children: RemixNode }>) {
  return () => (
    <form method="post" action={handle.props.action} data-rmx-document>
      <input type="hidden" name="_csrf" value={handle.props.csrf} />
      {handle.props.children}
    </form>
  )
}

export function Field(
  handle: Handle<{
    label: string
    name: string
    value: string
    error?: string
    description?: string
    type?: 'email' | 'url'
    required?: boolean
    disabled?: boolean
    placeholder?: string
    autocomplete?: string
  }>,
) {
  return () => {
    let { label, name, error, description, ...p } = handle.props
    return (
      <FormField label={label} controlId={name} description={description} errorText={error}>
        <Input {...p} id={name} name={name} invalid={Boolean(error)} />
      </FormField>
    )
  }
}

export function Actions(handle: Handle<{ cancel: string; children: RemixNode }>) {
  return () => (
    <SpaceBetween size="xs" direction="horizontal">
      <Button variant="link" href={handle.props.cancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit">
        {handle.props.children}
      </Button>
    </SpaceBetween>
  )
}

export function tableUrl(source: URL, pathname: string) {
  let url = new URL(pathname, source)
  url.search = source.search
  return url
}

export function tableFailure(label: string, href: string) {
  return (
    <Alert type="error" header={`Could not load ${label}`}>
      <a href={href}>Try again</a>
    </Alert>
  )
}
