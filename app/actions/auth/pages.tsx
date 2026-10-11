import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Button } from '../../ui/button.tsx'
import { Container } from '../../ui/container.tsx'
import { Header } from '../../ui/header.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { Document } from '../document.tsx'

const UNREACHABLE = 'Hack Club Auth is unreachable right now. Try again in a minute.'
const ERRORS: Record<string, string> = {
  idp_error: 'Hack Club Auth did not complete the sign-in. Try again.',
  unavailable: UNREACHABLE,
  discovery_failed: UNREACHABLE,
}

const centered = (title: string, header: RemixNode, children: RemixNode) => (
  <Document title={title}>
    <main class="centered-page">
      <Container header={header}>
        <SpaceBetween size="m">{children}</SpaceBetween>
      </Container>
    </main>
  </Document>
)

export function LoginPage(handle: Handle<{ csrfToken: string; error?: string; returnTo: string }>) {
  return () => {
    let { csrfToken, error, returnTo } = handle.props
    return centered(
      'welcome!',
      <Header variant="h1" description="staff only pls!">
        epic data yeeter 9000
      </Header>,
      <>
        {error ? (
          <Alert type="error" header="Sign-in failed">
            {ERRORS[error] ?? 'Something went wrong. Try again.'}{' '}
            <span class="text-secondary text-small">({error})</span>
          </Alert>
        ) : null}
        <form method="post" action={routes.auth.startLogin.href()}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" variant="primary" fullWidth>
            sign in
          </Button>
        </form>
      </>,
    )
  }
}

export function DeniedPage(handle: Handle<{ sub: string }>) {
  return () =>
    centered(
      'epic data yeeter 9000',
      <Header variant="h1">lmao no perms?</Header>,
      <>
        <Alert type="warning">
          if you really should be on this block, tell them to add this to the list:
        </Alert>
        <code>{handle.props.sub}</code>
        <Button href={routes.auth.login.href()}>Back to sign in</Button>
      </>,
    )
}
