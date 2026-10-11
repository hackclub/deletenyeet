import type { Database } from 'remix/data-table'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import type { Staff } from '../../auth/staff.ts'
import { recordAudit } from '../../data/audit.ts'
import { targets, type Target } from '../../data/tables.ts'
import { FAKE_TARGET_AUDIENCE, FAKE_TARGET_MODES } from '../../dev/fake-target.ts'
import { env } from '../../env.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { readEndpointConfig } from '../../targets/endpoint.ts'
import { UUID_PATTERN } from '../requests/format.ts'
import { fields, notFound, page, plural, setFlash, type Errors } from '../shared.tsx'
import { TargetFormPage, TargetsIndexPage, type TargetValues } from './pages.tsx'

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

let index = () => redirect(routes.targets.index.href(), 303)
let taken = async (db: Database, slug: string) =>
  (await db.findOne(targets, { where: { slug } })) !== null
let load = async (c: AppContext, id: string) =>
  UUID_PATTERN.test(id) ? c.db.find(targets, id) : null

function read(form?: FormData): TargetValues {
  let f = fields(form)
  return {
    name: f('name'),
    slug: f('slug').toLowerCase(),
    audience: f('audience'),
    url: f('url'),
    enabled: form?.get('enabled') === 'on',
  }
}

function validate(v: TargetValues, checkSlug: boolean) {
  let errors: Errors<TargetValues> = {}
  let long = (s: string) => s.length === 0 || s.length > 200
  if (long(v.name)) errors.name = 'Enter a name up to 200 characters.'
  if (checkSlug && (!SLUG.test(v.slug) || v.slug.length > 64))
    errors.slug = 'Use lowercase letters, digits, and single dashes.'
  if (long(v.audience)) errors.audience = 'Enter the audience the program expects.'
  let config = readEndpointConfig({ url: v.url })
  if (!config) errors.url = 'Enter an http or https URL.'
  else if (env.NODE_ENV === 'production' && !config.url.startsWith('https:'))
    errors.url = 'Production targets must use https.'
  return { errors, config }
}

let form = (
  c: AppContext,
  s: Staff,
  target: Target | null,
  values: TargetValues,
  errors: Errors<TargetValues> = {},
) => {
  let bad = Object.keys(errors).length > 0
  return c.render(
    <TargetFormPage base={page(c, s, !bad)} target={target} values={values} errors={errors} />,
    bad ? { status: 400 } : undefined,
  )
}

let register = (db: Database, sub: string, { url, ...t }: TargetValues, detail: object) =>
  db.transaction(async (tx) => {
    await tx.create(targets, { ...t, type: 'endpoint', config: { url } })
    await recordAudit(tx, {
      actor: { type: 'staff', id: sub },
      action: 'target.registered',
      detail: { slug: t.slug, type: 'endpoint', url, ...detail },
    })
  })

export default createController(routes.targets, {
  actions: {
    async index(c) {
      if (!c.auth.ok) return notFound()
      return c.render(
        <TargetsIndexPage
          base={page(c, c.auth.identity)}
          targets={await c.db.findMany(targets, { orderBy: ['name', 'asc'] })}
          url={c.url}
          development={env.NODE_ENV === 'development'}
        />,
      )
    },

    new(c) {
      if (!c.auth.ok) return notFound()
      return form(c, c.auth.identity, null, {
        name: '',
        slug: '',
        audience: '',
        url: '',
        enabled: true,
      })
    },

    async create(c) {
      if (!c.auth.ok) return notFound()
      let v = read(c.formData)
      let { errors, config } = validate(v, true)
      if (!errors.slug && (await taken(c.db, v.slug)))
        errors.slug = 'That slug is already registered.'
      if (Object.keys(errors).length > 0 || !config)
        return form(c, c.auth.identity, null, v, errors)
      await register(
        c.db,
        c.auth.identity.sub,
        { ...v, url: config.url },
        {
          audience: v.audience,
          enabled: v.enabled,
        },
      )
      setFlash(c.session, { type: 'success', header: `Registered ${v.name}` })
      return index()
    },

    async addFakes(c) {
      if (!c.auth.ok || env.NODE_ENV !== 'development') return notFound()
      let added = 0
      for (let mode of FAKE_TARGET_MODES) {
        let slug = `fake-${mode}`
        if (await taken(c.db, slug)) continue
        await register(
          c.db,
          c.auth.identity.sub,
          {
            name: `Fake target (${mode})`,
            slug,
            audience: FAKE_TARGET_AUDIENCE,
            url: `http://127.0.0.1:${env.FAKE_TARGET_PORT}/${mode}`,
            enabled: mode === 'ok' || mode === 'flaky',
          },
          { fake: true },
        )
        added++
      }
      setFlash(c.session, {
        type: 'success',
        header: `Added ${plural(added, 'fake target')}`,
        content: 'ok and flaky are enabled; enable down, reject, or missing to see failures.',
      })
      return index()
    },

    async edit(c) {
      if (!c.auth.ok) return notFound()
      let t = await load(c, c.params.id)
      if (!t) return notFound()
      return form(c, c.auth.identity, t, {
        name: t.name,
        slug: t.slug,
        audience: t.audience ?? '',
        url: readEndpointConfig(t.config)?.url ?? '',
        enabled: t.enabled,
      })
    },

    async update(c) {
      if (!c.auth.ok) return notFound()
      let t = await load(c, c.params.id)
      if (!t) return notFound()
      let v = { ...read(c.formData), slug: t.slug }
      let { errors, config } = validate(v, false)
      if (Object.keys(errors).length > 0 || !config) return form(c, c.auth.identity, t, v, errors)
      let before = {
        name: t.name,
        audience: t.audience,
        url: readEndpointConfig(t.config)?.url ?? null,
        enabled: t.enabled,
      }
      let after = { name: v.name, audience: v.audience, url: config.url, enabled: v.enabled }
      let changed = Object.fromEntries(
        Object.entries(after).flatMap(([k, to]) => {
          let from = before[k as keyof typeof before]
          return from === to ? [] : [[k, { from, to }]]
        }),
      )
      let { sub } = c.auth.identity
      let { url, ...rest } = after
      await c.db.transaction(async (tx) => {
        await tx.update(targets, t.id, { ...rest, config: { url } })
        await recordAudit(tx, {
          actor: { type: 'staff', id: sub },
          action: 'target.updated',
          detail: { slug: t.slug, changed },
        })
      })
      setFlash(c.session, { type: 'success', header: `Saved ${v.name}` })
      return index()
    },
  },
})
