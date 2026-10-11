import { completeAuth, finishExternalAuth, startExternalAuth } from 'remix/auth'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { LoginError, type HackClubProfile } from '../../auth/hackclub-provider.ts'
import { hackClubAuth, isAllowlisted, writeStaff } from '../../auth/staff.ts'
import { recordAudit } from '../../data/audit.ts'
import { logError } from '../../log.ts'
import { routes } from '../../routes.ts'
import { DeniedPage, LoginPage } from './pages.tsx'

const LOGIN_ERROR_KEY = 'loginError'

export default createController(routes.auth, {
  actions: {
    login(context) {
      if (context.auth.ok) return redirect(routes.home.href(), 303)

      let error = context.session.get(LOGIN_ERROR_KEY)
      return context.render(
        <LoginPage
          csrfToken={getCsrfToken(context)}
          error={typeof error === 'string' ? error : undefined}
          returnTo={context.url.searchParams.get('returnTo') ?? ''}
        />,
      )
    },

    async startLogin(context) {
      let returnTo = context.formData.get('returnTo')
      try {
        return await startExternalAuth(hackClubAuth, context, {
          returnTo: typeof returnTo === 'string' ? returnTo : null,
        })
      } catch (error) {
        logError('login start', error)
        context.session.flash(LOGIN_ERROR_KEY, 'unavailable')
        return redirect(routes.auth.login.href(), 303)
      }
    },

    async callback(context) {
      let finished
      try {
        finished = await finishExternalAuth<typeof context, HackClubProfile, 'hackclub'>(
          hackClubAuth,
          context,
        )
      } catch (error) {
        let reason = classifyCallbackError(error, context.url)
        if (reason === 'unexpected' || reason === 'discovery_failed')
          logError('login callback', error)
        await recordAudit(context.db, {
          actor: { type: 'system' },
          action: 'auth.login_failed',
          detail: { reason },
        })
        context.session.flash(LOGIN_ERROR_KEY, reason)
        return redirect(routes.auth.login.href(), 303)
      }

      let staff = finished.result.profile
      if (!isAllowlisted(staff.sub)) {
        await recordAudit(context.db, {
          actor: { type: 'system' },
          action: 'auth.login_denied',
          detail: { reason: 'not_allowlisted' },
        })
        return context.render(<DeniedPage sub={staff.sub} name={staff.name} />, { status: 403 })
      }

      writeStaff(completeAuth(context), staff)
      await recordAudit(context.db, {
        actor: { type: 'staff', id: staff.sub },
        action: 'auth.login',
      })
      return redirect(finished.returnTo ?? routes.home.href(), 303)
    },

    async logout(context) {
      if (context.auth.ok) {
        await recordAudit(context.db, {
          actor: { type: 'staff', id: context.auth.identity.sub },
          action: 'auth.logout',
        })
      }
      context.session.destroy()
      return redirect(routes.auth.login.href(), 303)
    },
  },
})

function classifyCallbackError(error: unknown, url: URL) {
  if (error instanceof LoginError) return error.code
  if (url.searchParams.has('error')) return 'idp_error'
  if (error instanceof Error && /state/i.test(error.message)) return 'invalid_state'
  if (error instanceof Error && /transaction/i.test(error.message)) return 'invalid_transaction'
  return 'unexpected'
}
