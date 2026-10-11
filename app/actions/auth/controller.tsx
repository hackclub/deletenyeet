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

const ERROR_KEY = 'loginError'
const toLogin = () => redirect(routes.auth.login.href(), 303)

export default createController(routes.auth, {
  actions: {
    login(context) {
      if (context.auth.ok) return redirect(routes.home.href(), 303)
      let error = context.session.get(ERROR_KEY)
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
      } catch (e) {
        logError('login start', e)
        context.session.flash(ERROR_KEY, 'unavailable')
        return toLogin()
      }
    },

    async callback(context) {
      let audit = (
        action: string,
        actor: { type: 'system' } | { type: 'staff'; id: string },
        reason?: string,
      ) => recordAudit(context.db, { actor, action, ...(reason && { detail: { reason } }) })
      let finished
      try {
        finished = await finishExternalAuth<typeof context, HackClubProfile, 'hackclub'>(
          hackClubAuth,
          context,
        )
      } catch (e) {
        let reason = classify(e, context.url)
        if (reason === 'unexpected' || reason === 'discovery_failed') logError('login callback', e)
        await audit('auth.login_failed', { type: 'system' }, reason)
        context.session.flash(ERROR_KEY, reason)
        return toLogin()
      }

      let { sub } = finished.result.profile
      if (!isAllowlisted(sub)) {
        await audit('auth.login_denied', { type: 'system' }, 'not_allowlisted')
        return context.render(<DeniedPage sub={sub} />, { status: 403 })
      }
      writeStaff(completeAuth(context), finished.result.profile)
      await audit('auth.login', { type: 'staff', id: sub })
      return redirect(finished.returnTo ?? routes.home.href(), 303)
    },

    async logout(context) {
      if (context.auth.ok)
        await recordAudit(context.db, {
          actor: { type: 'staff', id: context.auth.identity.sub },
          action: 'auth.logout',
        })
      context.session.destroy()
      return toLogin()
    },
  },
})

function classify(e: unknown, url: URL) {
  if (e instanceof LoginError) return e.code
  if (url.searchParams.has('error')) return 'idp_error'
  let m = e instanceof Error ? e.message : ''
  return /state/i.test(m)
    ? 'invalid_state'
    : /transaction/i.test(m)
      ? 'invalid_transaction'
      : 'unexpected'
}
