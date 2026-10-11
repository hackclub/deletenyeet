import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import type { Database } from 'remix/data-table'

import { recordAudit, type AuditActor } from '../../data/audit.ts'
import { targets } from '../../data/tables.ts'
import { FAKE_TARGET_AUDIENCE, FAKE_TARGET_MODES } from '../../dev/fake-target.ts'
import { env } from '../../env.ts'
import { routes } from '../../routes.ts'
import { readEndpointConfig } from '../../targets/endpoint.ts'
import { setFlash, takeFlashes } from '../flash.ts'
import { UUID_PATTERN } from '../requests/format.ts'
import { TargetFormPage, TargetsIndexPage, type TargetValues } from './pages.tsx'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

function notFound() {
  return new Response('Not Found', { status: 404 })
}

function readValues(form: FormData | undefined): TargetValues {
  let field = (name: string) => String(form?.get(name) ?? '').trim()
  return {
    name: field('name'),
    slug: field('slug').toLowerCase(),
    audience: field('audience'),
    url: field('url'),
    enabled: form?.get('enabled') === 'on',
  }
}

function validate(values: TargetValues, checkSlug: boolean) {
  let errors: Partial<Record<keyof TargetValues, string>> = {}
  if (values.name.length === 0 || values.name.length > 200) errors.name = 'Enter a name up to 200 characters.'
  if (checkSlug && (!SLUG_PATTERN.test(values.slug) || values.slug.length > 64)) {
    errors.slug = 'Use lowercase letters, digits, and single dashes.'
  }
  if (values.audience.length === 0 || values.audience.length > 200) errors.audience = 'Enter the audience the program expects.'
  let config = readEndpointConfig({ url: values.url })
  if (!config) errors.url = 'Enter an http or https URL.'
  else if (env.NODE_ENV === 'production' && !config.url.startsWith('https:')) errors.url = 'Production targets must use https.'
  return { errors, config }
}

async function slugTaken(db: Database, slug: string) {
  return (await db.findOne(targets, { where: { slug } })) !== null
}

export default createController(routes.targets, {
  actions: {
    async index(context) {
      if (!context.auth.ok) return notFound()
      return context.render(
        <TargetsIndexPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          targets={await context.db.findMany(targets, { orderBy: ['name', 'asc'] })}
          url={context.url}
          development={env.NODE_ENV === 'development'}
        />,
      )
    },

    new(context) {
      if (!context.auth.ok) return notFound()
      return context.render(
        <TargetFormPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          target={null}
          values={{ name: '', slug: '', audience: '', url: '', enabled: true }}
          errors={{}}
        />,
      )
    },

    async create(context) {
      if (!context.auth.ok) return notFound()
      let values = readValues(context.formData)
      let { errors, config } = validate(values, true)
      if (!errors.slug && (await slugTaken(context.db, values.slug))) errors.slug = 'That slug is already registered.'
      if (Object.keys(errors).length > 0 || !config) {
        return context.render(
          <TargetFormPage staff={context.auth.identity} csrfToken={getCsrfToken(context)} flashes={[]} target={null} values={values} errors={errors} />,
          { status: 400 },
        )
      }
      let actor: AuditActor = { type: 'staff', id: context.auth.identity.sub }
      await context.db.transaction(async (tx) => {
        await tx.create(targets, {
          name: values.name,
          slug: values.slug,
          type: 'endpoint',
          audience: values.audience,
          config: { url: config.url },
          enabled: values.enabled,
        })
        await recordAudit(tx, {
          actor,
          action: 'target.registered',
          detail: { slug: values.slug, type: 'endpoint', audience: values.audience, url: config.url, enabled: values.enabled },
        })
      })
      setFlash(context.session, { type: 'success', header: `Registered ${values.name}` })
      return redirect(routes.targets.index.href(), 303)
    },

    async addFakes(context) {
      if (!context.auth.ok || env.NODE_ENV !== 'development') return notFound()
      let actor: AuditActor = { type: 'staff', id: context.auth.identity.sub }
      let added = 0
      for (let mode of FAKE_TARGET_MODES) {
        let slug = `fake-${mode}`
        if (await slugTaken(context.db, slug)) continue
        let url = `http://127.0.0.1:${env.FAKE_TARGET_PORT}/${mode}`
        await context.db.transaction(async (tx) => {
          await tx.create(targets, {
            name: `Fake target (${mode})`,
            slug,
            type: 'endpoint',
            audience: FAKE_TARGET_AUDIENCE,
            config: { url },
            enabled: mode === 'ok' || mode === 'flaky',
          })
          await recordAudit(tx, { actor, action: 'target.registered', detail: { slug, type: 'endpoint', url, fake: true } })
        })
        added++
      }
      setFlash(context.session, {
        type: 'success',
        header: `Added ${added} fake target${added === 1 ? '' : 's'}`,
        content: 'ok and flaky are enabled; enable down, reject, or missing to see failures.',
      })
      return redirect(routes.targets.index.href(), 303)
    },

    async edit(context) {
      if (!context.auth.ok) return notFound()
      if (!UUID_PATTERN.test(context.params.id)) return notFound()
      let target = await context.db.find(targets, context.params.id)
      if (!target) return notFound()
      return context.render(
        <TargetFormPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          target={target}
          values={{
            name: target.name,
            slug: target.slug,
            audience: target.audience ?? '',
            url: readEndpointConfig(target.config)?.url ?? '',
            enabled: target.enabled,
          }}
          errors={{}}
        />,
      )
    },

    async update(context) {
      if (!context.auth.ok) return notFound()
      if (!UUID_PATTERN.test(context.params.id)) return notFound()
      let target = await context.db.find(targets, context.params.id)
      if (!target) return notFound()
      let values = { ...readValues(context.formData), slug: target.slug }
      let { errors, config } = validate(values, false)
      if (Object.keys(errors).length > 0 || !config) {
        return context.render(
          <TargetFormPage staff={context.auth.identity} csrfToken={getCsrfToken(context)} flashes={[]} target={target} values={values} errors={errors} />,
          { status: 400 },
        )
      }
      let before = { name: target.name, audience: target.audience, url: readEndpointConfig(target.config)?.url ?? null, enabled: target.enabled }
      let after = { name: values.name, audience: values.audience, url: config.url, enabled: values.enabled }
      let changed = Object.fromEntries(
        Object.entries(after)
          .filter(([key, value]) => before[key as keyof typeof before] !== value)
          .map(([key, value]) => [key, { from: before[key as keyof typeof before], to: value }]),
      )
      await context.db.transaction(async (tx) => {
        await tx.update(targets, target.id, {
          name: values.name,
          audience: values.audience,
          config: { url: config.url },
          enabled: values.enabled,
        })
        await recordAudit(tx, {
          actor: { type: 'staff', id: context.auth.ok ? context.auth.identity.sub : '' },
          action: 'target.updated',
          detail: { slug: target.slug, changed },
        })
      })
      setFlash(context.session, { type: 'success', header: `Saved ${values.name}` })
      return redirect(routes.targets.index.href(), 303)
    },
  },
})
