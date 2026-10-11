import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import { Header } from '../../ui/header.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { Document } from '../document.tsx'

const ERROR_MESSAGES: Record<string, string> = {
  idp_error: 'Hack Club Auth did not complete the sign-in. Try again.',
  unavailable: 'Hack Club Auth is unreachable right now. Try again in a minute.',
  discovery_failed: 'Hack Club Auth is unreachable right now. Try again in a minute.',
}

export function LoginPage(handle: Handle<{ csrfToken: string; error?: string; returnTo: string }>) {
  return () => {
    let { csrfToken, error, returnTo } = handle.props
    return (
      <Document title="Sign in · Privacy request hub">
        <main class="centered-page">
          <Container
            header={
              <Header variant="h1" description="Hack Club staff only. Sign in with your Hack Club account.">
                Privacy request hub
              </Header>
            }
          >
            <SpaceBetween size="m">
              {error ? (
                <Alert type="error" header="Sign-in failed">
                  {ERROR_MESSAGES[error] ?? 'Something went wrong. Try again.'}{' '}
                  <span class="text-secondary text-small">({error})</span>
                </Alert>
              ) : null}
              <form method="post" action={routes.auth.startLogin.href()}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <Button type="submit" variant="primary" fullWidth>
                  Sign in with Hack Club
                </Button>
              </form>
            </SpaceBetween>
          </Container>
        </main>
      </Document>
    )
  }
}

export function DeniedPage(handle: Handle<{ sub: string; name: string | null }>) {
  return () => {
    let { sub, name } = handle.props
    return (
      <Document title="Access denied · Privacy request hub">
        <main class="centered-page">
          <Container header={<Header variant="h1">Not on the staff allowlist</Header>}>
            <SpaceBetween size="m">
              <Alert type="warning">
                {name ? `${name}, your` : 'Your'} Hack Club account signed in, but it is not allowed to use
                this tool. Ask an admin to add this ID to <code>STAFF_SUBS</code>.
              </Alert>
              <code>{sub}</code>
              <Button href={routes.auth.login.href()}>Back to sign in</Button>
            </SpaceBetween>
          </Container>
        </main>
      </Document>
    )
  }
}
