import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { createRequest, normalizeEmail, RequestStateError } from '../../data/requests.ts'
import { requests } from '../../data/tables.ts'
import { approveRequest, rejectRequest, startDryRun } from '../../flow/flow.ts'
import { enqueueResolve } from '../../jobs/boss.ts'
import { logError } from '../../log.ts'
import { routes } from '../../routes.ts'
import { setFlash, takeFlashes } from '../flash.ts'
import { listRequests, loadRequestDetail } from './data.ts'
import { UUID_PATTERN } from './format.ts'
import {
  NewRequestPage,
  RequestShowPage,
  RequestsIndexPage,
  type NewRequestValues,
} from './pages.tsx'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLACK_ID_PATTERN = /^[UW][A-Z0-9]{4,20}$/
const TABS = ['review', 'execution', 'audit']

function notFound() {
  return new Response('Not Found', { status: 404 })
}

export default createController(routes.requests, {
  actions: {
    async index(context) {
      if (!context.auth.ok) return notFound()
      return context.render(
        <RequestsIndexPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          requests={await listRequests(context.db)}
          url={context.url}
        />,
      )
    },

    new(context) {
      if (!context.auth.ok) return notFound()
      return context.render(
        <NewRequestPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          values={{ type: 'delete', email: '', slackId: '', identityId: '' }}
          errors={{}}
        />,
      )
    },

    async create(context) {
      if (!context.auth.ok) return notFound()
      let form = context.formData
      let field = (name: string) => String(form?.get(name) ?? '').trim()
      let values: NewRequestValues = {
        type: field('type'),
        email: field('email'),
        slackId: field('slack_id').toUpperCase(),
        identityId: field('identity_id'),
      }
      let errors: Partial<Record<keyof NewRequestValues, string>> = {}
      if (values.type !== 'delete' && values.type !== 'export')
        errors.type = 'Choose delete or export.'
      if (!EMAIL_PATTERN.test(values.email) || values.email.length > 320)
        errors.email = 'Enter a valid email address.'
      if (values.slackId && !SLACK_ID_PATTERN.test(values.slackId))
        errors.slackId = 'Slack IDs look like U0123ABCD.'
      if (values.identityId.length > 200) errors.identityId = 'That ID is too long.'

      if (Object.keys(errors).length > 0) {
        return context.render(
          <NewRequestPage
            staff={context.auth.identity}
            csrfToken={getCsrfToken(context)}
            flashes={[]}
            values={values}
            errors={errors}
          />,
          { status: 400 },
        )
      }

      let staff = context.auth.identity
      let request = await createRequest(context.db, {
        type: values.type as 'delete' | 'export',
        email: normalizeEmail(values.email),
        slackId: values.slackId || null,
        identityId: values.identityId || null,
        actor: { type: 'staff', id: staff.sub },
        source: { kind: 'manual', createdBy: staff.sub },
      })
      try {
        await enqueueResolve(request.id)
      } catch (error) {
        logError(`enqueue resolve ${request.id}`, error)
      }
      setFlash(context.session, {
        type: 'success',
        header: 'Request created',
        content: 'The dry run starts in a moment.',
      })
      return redirect(routes.requests.show.href({ id: request.id }), 303)
    },

    async show(context) {
      if (!context.auth.ok) return notFound()
      let id = context.params.id
      if (!UUID_PATTERN.test(id)) return notFound()
      let detail = await loadRequestDetail(context.db, id)
      if (!detail) return notFound()
      let requested = context.url.searchParams.get('tab') ?? ''
      let tab = TABS.includes(requested)
        ? requested
        : ['executing', 'completed', 'partially_failed'].includes(detail.request.status)
          ? 'execution'
          : 'review'
      return context.render(
        <RequestShowPage
          staff={context.auth.identity}
          csrfToken={getCsrfToken(context)}
          flashes={takeFlashes(context.session)}
          detail={detail}
          tab={tab}
        />,
      )
    },

    async approve(context) {
      if (!context.auth.ok) return notFound()
      let id = context.params.id
      if (!UUID_PATTERN.test(id)) return notFound()
      try {
        await approveRequest(context.db, id, { type: 'staff', id: context.auth.identity.sub })
        setFlash(context.session, {
          type: 'success',
          header: 'Approved',
          content: 'Execution has started.',
        })
      } catch (error) {
        if (!(error instanceof RequestStateError)) throw error
        setFlash(context.session, {
          type: 'error',
          header: 'Could not approve',
          content: error.message,
        })
      }
      return redirect(routes.requests.show.href({ id }), 303)
    },

    async reject(context) {
      if (!context.auth.ok) return notFound()
      let id = context.params.id
      if (!UUID_PATTERN.test(id)) return notFound()
      let request = await context.db.find(requests, id)
      if (!request) return notFound()
      try {
        await rejectRequest(context.db, id, request.status, {
          type: 'staff',
          id: context.auth.identity.sub,
        })
        setFlash(context.session, {
          type: 'success',
          header: 'Rejected',
          content: 'Nothing will be executed.',
        })
      } catch (error) {
        if (!(error instanceof RequestStateError)) throw error
        setFlash(context.session, {
          type: 'error',
          header: 'Could not reject',
          content: error.message,
        })
      }
      return redirect(routes.requests.show.href({ id }), 303)
    },

    async rerunDryRun(context) {
      if (!context.auth.ok) return notFound()
      let id = context.params.id
      if (!UUID_PATTERN.test(id)) return notFound()
      try {
        await startDryRun(context.db, id, 'awaiting_approval', {
          type: 'staff',
          id: context.auth.identity.sub,
        })
        setFlash(context.session, { type: 'info', header: 'Re-running failed dry runs' })
      } catch (error) {
        if (!(error instanceof RequestStateError)) throw error
        setFlash(context.session, {
          type: 'error',
          header: 'Could not re-run',
          content: error.message,
        })
      }
      return redirect(routes.requests.show.href({ id }), 303)
    },
  },
})
