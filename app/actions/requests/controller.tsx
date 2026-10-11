import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import type { Staff } from '../../auth/staff.ts'
import { createRequest, normalizeEmail, RequestStateError } from '../../data/requests.ts'
import { requests } from '../../data/tables.ts'
import { approveRequest, rejectRequest, startDryRun } from '../../flow/flow.ts'
import { enqueueResolve } from '../../jobs/boss.ts'
import { logError } from '../../log.ts'
import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import {
  fields,
  notFound,
  page,
  tableFailure,
  tableUrl,
  setFlash,
  type Errors,
  type Flash,
} from '../shared.tsx'
import { listRequests, loadRequestDetail } from './data.ts'
import { UUID_PATTERN } from './format.ts'
import {
  NewRequestPage,
  RequestShowPage,
  RequestsIndexPage,
  RequestsTable,
  type NewRequestValues,
} from './pages.tsx'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLACK_ID = /^[UW][A-Z0-9]{4,20}$/
const TABS = ['review', 'execution', 'audit']

type Actor = { type: 'staff'; id: string }

let form = (
  c: AppContext,
  s: Staff,
  values: NewRequestValues,
  errors: Errors<NewRequestValues> = {},
) => {
  let bad = Object.keys(errors).length > 0
  return c.render(
    <NewRequestPage base={page(c, s, !bad)} values={values} errors={errors} />,
    bad ? { status: 400 } : undefined,
  )
}

async function act(
  c: AppContext,
  id: string,
  run: (actor: Actor) => Promise<unknown>,
  ok: Flash,
  fail: string,
) {
  if (!c.auth.ok || !UUID_PATTERN.test(id)) return notFound()
  try {
    await run({ type: 'staff', id: c.auth.identity.sub })
    setFlash(c.session, ok)
  } catch (e) {
    if (!(e instanceof RequestStateError)) throw e
    setFlash(c.session, { type: 'error', header: fail, content: e.message })
  }
  return redirect(routes.requests.show.href({ id }), 303)
}

export default createController(routes.requests, {
  actions: {
    async index(c) {
      if (!c.auth.ok) return notFound()
      return c.render(
        <RequestsIndexPage
          base={page(c, c.auth.identity)}
          requests={c.request.headers.has('X-Remix-Frame') ? undefined : await listRequests(c.db)}
          tableSrc={tableUrl(c.url, routes.requests.table.href()).href}
          url={c.url}
        />,
      )
    },

    async table(c) {
      if (!c.auth.ok) return notFound()
      let url = tableUrl(c.url, routes.requests.index.href())
      if (!c.request.headers.has('X-Remix-Frame')) return redirect(url.pathname + url.search)
      try {
        let items = await listRequests(c.db)
        if (c.request.signal.aborted) return new Response(null, { status: 204 })
        return c.render(<RequestsTable requests={items} url={url} refresh />)
      } catch (error) {
        if (c.request.signal.aborted) return new Response(null, { status: 204 })
        logError('load requests table', error)
        return c.render(tableFailure('requests', url.pathname + url.search))
      }
    },

    new(c) {
      if (!c.auth.ok) return notFound()
      return form(c, c.auth.identity, { type: 'delete', email: '', slackId: '', identityId: '' })
    },

    async create(c) {
      if (!c.auth.ok) return notFound()
      let f = fields(c.formData)
      let v: NewRequestValues = {
        type: f('type'),
        email: f('email'),
        slackId: f('slack_id').toUpperCase(),
        identityId: f('identity_id'),
      }
      let errors: Errors<NewRequestValues> = {}
      if (v.type !== 'delete' && v.type !== 'export') errors.type = 'Choose delete or export.'
      if (!EMAIL.test(v.email) || v.email.length > 320)
        errors.email = 'Enter a valid email address.'
      if (v.slackId && !SLACK_ID.test(v.slackId)) errors.slackId = 'Slack IDs look like U0123ABCD.'
      if (v.identityId.length > 200) errors.identityId = 'That ID is too long.'
      if (Object.keys(errors).length > 0) return form(c, c.auth.identity, v, errors)

      let { sub } = c.auth.identity
      let { id } = await createRequest(c.db, {
        type: v.type as 'delete' | 'export',
        email: normalizeEmail(v.email),
        slackId: v.slackId || null,
        identityId: v.identityId || null,
        actor: { type: 'staff', id: sub },
        source: { kind: 'manual', createdBy: sub },
      })
      await enqueueResolve(id).catch((e) => logError(`enqueue resolve ${id}`, e))
      setFlash(c.session, {
        type: 'success',
        header: 'Request created',
        content: 'The dry run starts in a moment.',
      })
      return redirect(routes.requests.show.href({ id }), 303)
    },

    async show(c) {
      if (!c.auth.ok) return notFound()
      let detail = UUID_PATTERN.test(c.params.id) && (await loadRequestDetail(c.db, c.params.id))
      if (!detail) return notFound()
      let t = c.url.searchParams.get('tab') ?? ''
      let tab = TABS.includes(t)
        ? t
        : ['executing', 'completed', 'partially_failed'].includes(detail.request.status)
          ? 'execution'
          : 'review'
      return c.render(<RequestShowPage base={page(c, c.auth.identity)} detail={detail} tab={tab} />)
    },

    approve: (c) =>
      act(
        c,
        c.params.id,
        (a) => approveRequest(c.db, c.params.id, a),
        { type: 'success', header: 'Approved', content: 'Execution has started.' },
        'Could not approve',
      ),

    async reject(c) {
      let { id } = c.params
      let r = UUID_PATTERN.test(id) && (await c.db.find(requests, id))
      if (!r) return notFound()
      return act(
        c,
        id,
        (a) => rejectRequest(c.db, id, r.status, a),
        { type: 'success', header: 'Rejected', content: 'Nothing will be executed.' },
        'Could not reject',
      )
    },

    rerunDryRun: (c) =>
      act(
        c,
        c.params.id,
        (a) => startDryRun(c.db, c.params.id, 'awaiting_approval', a),
        { type: 'info', header: 'Re-running failed dry runs' },
        'Could not re-run',
      ),
  },
})
