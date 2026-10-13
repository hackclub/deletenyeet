import type { Handle } from 'remix/component'

import type { Staff } from '../../auth/staff.ts'
import { routes } from '../../routes.ts'
import { Alert } from '../../ui/alert.tsx'
import { Container } from '../../ui/container.tsx'
import { GuestPage } from '../../ui/guest-page.tsx'
import { Header } from '../../ui/header.tsx'
import { CodeBlock, Prose } from '../../ui/prose.tsx'
import { SpaceBetween } from '../../ui/space-between.tsx'
import { CopyButton } from '../../ui/public/copy-button.tsx'
import { StaffPage } from '../../ui/staff-page.tsx'

const JWKS_URL = 'https://yeet.hackclub.com/.well-known/jwks.json'
const DOCS_URL = `https://yeet.hackclub.com${routes.docs.deletions.href()}`

const PROMPT = `Add the Hack Club data yeeter endpoints to this codebase. The spec is at ${DOCS_URL}. Read all of it before you start.

Before writing any code:
1. Ask me for the audience string. Yeeter staff set it for this program, and the token's aud claim must match it exactly.
2. List every table, file store, and external service that holds data about a user. For each one, say whether you would delete it, or keep it detached from the account (things other people depend on, like orders, payouts, or ledger entries), and why. Wait for me to approve that list.

Then build:
- POST /api/privacy/delete and POST /api/privacy/export. There is no request body. The token arrives as Authorization: Bearer <token>.
- Verify the token as an ES256 JWT against ${JWKS_URL}. Let an env var override that url, but default to it. Check typ JWT, issuer hackclub-privacy, the audience, 30 seconds of clock leeway, exp minus iat no more than 300 seconds, and that the action claim matches the endpoint.
- Store each jti in a database table and reject repeats with 409 {"error": "replayed"}.
- Find the person only from the token's subject claims (emails, slack_id, identity_id). Never read identifiers from the body or query string.
- For delete, run the real deletion inside a transaction, count what it removed, and roll back when dry_run is true. Delete files in external storage only when dry_run is false, before committing.
- Export must never change anything.
- Respond with request_id, found, dry_run, deleted, and retained exactly as the spec shows. Errors look like {"error": "snake_case_code"}.
- Never log tokens, emails, Slack ids, or identity ids. Log only request_id and the outcome.
- Write docs/privacy.md explaining what gets deleted and what gets kept, like the reference implementations linked from the spec.`

const TOKEN_EXAMPLE = `// header
{ "alg": "ES256", "typ": "JWT", "kid": "2026-10-11-mrXnQja1" }

// payload
{
  "iss": "hackclub-privacy",
  "aud": "your-program",
  "iat": 1791676800,
  "exp": 1791677100,
  "jti": "01a1296f-…-your-program-delete-1-3f9c2a7b1e04",
  "request_id": "01a1296f-83fb-7bd1-b99f-5d8d3acda667",
  "action": "delete",
  "dry_run": true,
  "subject": {
    "emails": ["someone@example.com"],
    "slack_id": "U0123456789",
    "identity_id": "ident!AbC123"
  }
}`

const VERIFY_EXAMPLE = `import { createRemoteJWKSet, jwtVerify } from 'jose'

let jwks = createRemoteJWKSet(new URL('${JWKS_URL}'))

export async function verifyPrivacyToken(token: string, endpoint: 'delete' | 'export') {
  let { payload } = await jwtVerify(token, jwks, {
    algorithms: ['ES256'],
    typ: 'JWT',
    issuer: 'hackclub-privacy',
    audience: 'your-program',
    maxTokenAge: 300,
    clockTolerance: 30,
  })
  if (payload.exp! - payload.iat! > 300) throw new Error('invalid_lifetime')
  if (payload.action !== endpoint) throw new Error('action_mismatch')
  // then record payload.jti, and refuse it if it was already recorded
  return payload
}`

const RESPONSE_EXAMPLE = `{
  "request_id": "01a1296f-83fb-7bd1-b99f-5d8d3acda667",
  "found": true,
  "dry_run": true,
  "deleted": { "users": 1, "projects": 2, "comments": 14 },
  "retained": [
    {
      "type": "shop orders",
      "count": 3,
      "reason": "kept for accounting and fulfilment; detached from the account"
    }
  ]
}`

const REPLAY_EXAMPLE = `create table privacy_token_uses (
  jti text primary key,
  used_at timestamptz not null default now()
);

-- first use when this inserts a row; a replay inserts nothing
insert into privacy_token_uses (jti) values ($1) on conflict do nothing;

-- prune rows far older than any token can live
delete from privacy_token_uses where used_at < now() - interval '1 day';`

const REFERENCES = [
  {
    name: 'Summer of Making',
    stack: 'rails. cascading foreign keys, leftover records detached from the account',
    href: 'https://github.com/hackclub/summer-of-making/blob/main/docs/privacy.md',
  },
  {
    name: 'Flavortown',
    stack:
      'rails. the ledger is immutable, so account and project rows stay as anonymous placeholders',
    href: 'https://github.com/hackclub/flavortown/blob/main/docs/privacy.md',
  },
  {
    name: 'Lapse',
    stack: 'fastify + prisma. deletes in foreign key order, s3 cleaned up first',
    href: 'https://github.com/hackclub/lapse/blob/main/docs/privacy.md',
  },
]

export function DeletionsDocsPage(handle: Handle<{ staff: Staff | null; csrfToken: string }>) {
  return () => {
    let { staff, csrfToken } = handle.props
    let p = { title: 'how to yeet data properly', activeHref: routes.docs.deletions.href() }
    return staff ? (
      <StaffPage {...p} staff={staff} csrfToken={csrfToken}>
        <DeletionsDocs />
      </StaffPage>
    ) : (
      <GuestPage {...p}>
        <DeletionsDocs />
      </GuestPage>
    )
  }
}

function DeletionsDocs() {
  return () => (
    <SpaceBetween size="l">
      <Header variant="h1" description="this easy guide will help satisfy karens worldwide">
        how to yeet data properly
      </Header>

      <Container>
        <Prose>
          <p>
            &gt; be the hack club infra guy
            <br />
            &gt; someone asks for their data to be deleted
            <br />
            &gt; roll your own SQL scripts against program dbs
            <br />
            &gt; pray it dont break anything
          </p>
          <p>
            help us not have to do that. instead, implement just two endpoints to your program, we
            handle the rest! save us from having to run arbitrary SQL against your database, and
            save yourself from dealing with the #fallout.
          </p>

          <Alert type="info" header="the short version, if you've never built an api">
            <ol>
              <li>you add two urls to your app that the yeeter can POST to.</li>
              <li>
                every call comes with a token. a token is a signed note from the yeeter that says
                "this person, this action, signed by the right people". a library checks the
                signature for you, so nobody can fake one. you don't need to understand the crypto.
              </li>
              <li>you find the person in your database using the details inside the token.</li>
              <li>
                first call is a practice run to make sure everything works as expected: say what you{' '}
                <em>would</em> delete and change nothing. a human checks to make sure this is legit
                and the second call is the real deletion.
              </li>
              <li>you answer with counts, never with their personal data.</li>
            </ol>
          </Alert>

          <h2>let your agent do it</h2>
          <p>
            if you use a coding agent, copy this prompt, paste it in your repo, and review what it
            builds. it will ask you for your audience and walk you through what gets deleted before
            writing anything. you still own the result, so read this page anyway.
          </p>
          <CopyButton text={PROMPT} label="Copy prompt for agents" />
          <details>
            <summary>show the prompt</summary>
            <CodeBlock wrap>{PROMPT}</CodeBlock>
          </details>

          <h2>how a request plays out</h2>
          <ol>
            <li>someone asks Hack Club to delete their data, and it lands in the yeeter.</li>
            <li>
              the yeeter calls <code>/api/privacy/delete</code> on every program with{' '}
              <code>dry_run: true</code>. you work out exactly what you'd delete and keep, report
              the counts, and change <strong>nothing</strong>.
            </li>
            <li>
              staff read every program's counts. if something looks off (you'd delete 40,000
              comments for one person?) they stop here and nothing has been touched.
            </li>
            <li>
              once they approve, the yeeter calls the same endpoint again with{' '}
              <code>dry_run: false</code>. now you actually delete, and report what you removed.
            </li>
          </ol>
          <p>
            the dry run and the real run should give the same numbers. the reviewer approved those
            numbers, so surprising them in the real run is bad.
          </p>

          <h2>the endpoints</h2>
          <ul>
            <li>
              <code>POST /api/privacy/delete</code> nukes everything that belongs to the person. on
              a dry run it just tells us what it <em>would</em> nuke.
            </li>
            <li>
              <code>POST /api/privacy/export</code> tells us what you have on them. we are not sure
              how to operate exports yet, so this one should never change anything.
            </li>
          </ul>
          <p>
            we hit your url with <code>Authorization: Bearer &lt;token&gt;</code> and{' '}
            <code>Accept: application/json</code>, no body. we will give up after{' '}
            <strong>15 seconds</strong> and we don't follow redirects.
          </p>

          <h2>the token</h2>
          <p>
            every request gets a fresh ES256 JWT that lives for 5 minutes max. it's bound to your
            epic program. here's what one looks like:
          </p>
          <CodeBlock language="json" label="a decoded token">
            {TOKEN_EXAMPLE}
          </CodeBlock>
          <ul>
            <li>
              <code>aud</code> is your program's audience. more on that right below.
            </li>
            <li>
              <code>request_id</code> is the only thing from this you should log. seriously.
            </li>
            <li>
              <code>dry_run</code> is <code>true</code> on the practice run and <code>false</code>{' '}
              on the real one. if it's <code>true</code>, your database must look exactly the same
              after the call as before it.
            </li>
            <li>
              <code>jti</code> is unique per call, retries included.
            </li>
          </ul>

          <h3>the audience</h3>
          <p>
            the audience is just a string that names your program, like <code>flavortown</code>.
            it's what stops a token meant for one program from working on another. two places have
            to agree on it:
          </p>
          <ul>
            <li>
              <strong>the yeeter.</strong> staff type it in when they add your program as a target.
            </li>
            <li>
              <strong>your code.</strong> you hardcode the same string in your token check.
            </li>
          </ul>
          <p>
            it has to match <strong>exactly</strong>. <code>summer-of-making</code>,{' '}
            <code>summer_of_making</code>, and <code>Summer of Making</code> are three different
            audiences. to keep it boring, use lowercase letters and hyphens, and tell us what you
            picked when you ask to be added. if they don't match, every call fails with a{' '}
            <code>401</code> and nothing gets deleted, so it's annoying but not dangerous.
          </p>

          <h2>verifying it</h2>
          <Alert type="warning" header="do NOT skip this">
            this check is the only thing stopping a random person on the internet from deleting your
            users. use a jwt library (like <code>jose</code> for js, <code>ruby-jwt</code> for ruby,{' '}
            <code>pyjwt</code> for python) and do every step below. ask us if anything is unclear.
          </Alert>
          <ol>
            <li>
              grab the public keys from <code>{JWKS_URL}</code>. cache them for ~5 minutes, and
              refetch (at most every 30 seconds or so) when a token names a <code>kid</code> you
              haven't seen. that way key rotation just works and you never hear about it.
            </li>
            <li>
              only accept <code>alg: ES256</code> with <code>typ: JWT</code>, and check the
              signature against the key that <code>kid</code> names. if your jwt library lets you
              skip the alg check, don't.
            </li>
            <li>
              <code>iss</code> must be <code>hackclub-privacy</code> and <code>aud</code> must be
              exactly your audience.
            </li>
            <li>
              check <code>exp</code> and <code>iat</code> with ~30 seconds of leeway, and reject
              anything where <code>exp − iat</code> is over 300 seconds.
            </li>
            <li>
              <code>action</code> has to match the endpoint that got called. a delete token sent to{' '}
              <code>/export</code> is a 400.
            </li>
            <li>
              record the <code>jti</code> and reject repeats. put it in your database, not a cache.
              ask us how we know: some cache clients report a failed write the same way as "key
              already exists", so every token looks replayed and you get a wall of 409s.
            </li>
            <li>
              only trust the claims. never read identifiers from the body or query string. if anyone
              can POST you an email and get it deleted, that's not a feature.
            </li>
          </ol>
          <CodeBlock language="js" label="verifying a token with jose">
            {VERIFY_EXAMPLE}
          </CodeBlock>
          <CodeBlock language="sql" label="remembering which tokens you've seen">
            {REPLAY_EXAMPLE}
          </CodeBlock>
          <p>
            if you do make the jwks url overridable with an env var, thats cool but make sure it
            defaults to the real one.
          </p>

          <h2>finding the person</h2>
          <ul>
            <li>
              <code>emails</code> come lowercased from the yeeter. compare them case-insensitively
              against every email column you have on them, including the weird secondary one you
              forgot about.
            </li>
            <li>
              <code>slack_id</code> and <code>identity_id</code> (the Hack Club Auth{' '}
              <code>ident!…</code> id) can be <code>null</code> since we dont always have them. if
              they are present, match them against your records too.
            </li>
            <li>
              no match? return <code>200</code> with <code>found: false</code> and we wont bug you
              again about this person.
            </li>
          </ul>

          <h2>deleting stuff</h2>
          <ul>
            <li>
              <strong>delete what's theirs.</strong> account, profile, content, uploads, sessions,
              login identities, analytics, and any versioning or audit rows that copy their data.
              yes, paper_trail counts.
            </li>
            <li>
              <strong>keep what other people depend on, detached.</strong> orders, payouts, ledger
              entries, fraud reports, and votes that affect other people's rankings can stay. null
              the user reference, or keep an anonymous placeholder row with every personal field
              wiped. list each kind in <code>retained</code> with a reason a reviewer would actually
              buy.
            </li>
            <li>
              <strong>close open work.</strong> cancel unfulfilled orders and pending payouts or
              anything outstanding.
            </li>
            <li>
              <strong>fix other people's numbers.</strong> recount likes, comments, followers, and
              votes on stuff you didn't delete.
            </li>
            <li>
              <strong>external storage goes first.</strong> delete files in s3 or rows in other
              databases before you commit the main transaction. if that blows up, the retry still
              finds the person and finishes the job.
            </li>
            <li>
              <strong>one code path for both runs.</strong> the best dry run does the real deletion
              inside a transaction, counts what it removed, and rolls back. the numbers a reviewer
              approves are then the numbers that actually run. a separate "count what we'd delete"
              function will drift and lie to you eventually.
            </li>
            <li>
              <strong>refuse what needs a human.</strong> if the account owns something only staff
              should decide about, like api keys other services depend on, return <code>409</code>{' '}
              with <code>manual_review_required</code> instead of guessing.
            </li>
          </ul>

          <h2>what to send back</h2>
          <CodeBlock language="json" label="a dry run response">
            {RESPONSE_EXAMPLE}
          </CodeBlock>
          <ul>
            <li>
              echo <code>request_id</code> and <code>dry_run</code> exactly as the token had them.
              the yeeter rejects responses that don't.
            </li>
            <li>
              <code>deleted</code> maps a table or record type (100 characters max) to a
              non-negative row count.
            </li>
            <li>
              each <code>retained</code> entry has a <code>type</code> (100 characters max), a{' '}
              <code>count</code>, and a <code>reason</code> (500 characters max).
            </li>
            <li>dont send back pii in the response, just the counts and reasons.</li>
          </ul>

          <h2>errors and retries</h2>
          <p>
            errors look like <code>{'{"error": "snake_case_code"}'}</code>. staff see it as
            something like <code>http_409_replayed</code>, so keep it short and snappy!
          </p>
          <ul>
            <li>
              <code>408</code>, <code>425</code>, <code>429</code>, <code>500</code>,{' '}
              <code>502</code>, <code>503</code>, <code>504</code>, timeouts, and network errors get
              retried after 10, 30, 90, and 270 seconds. after 5 attempts it's marked failed.
            </li>
            <li>
              anything else fails immediately and shows up for staff. <code>401</code> for a bad
              token, <code>400 action_mismatch</code>, <code>409 replayed</code>, and{' '}
              <code>409 manual_review_required</code>.
            </li>
            <li>
              <code>503</code> when something you depend on, like the jwks or s3, is having a
              moment, so the yeeter tries again.
            </li>
          </ul>

          <h2>logging</h2>
          <p>
            log the <code>request_id</code> and the outcome.{' '}
            <strong>
              do not log the token, emails, slack or identity ids, or anything you deleted.
            </strong>{' '}
            logging the email of the person who asked to be forgotten is peak irony. please don't do
            it.
          </p>

          <h2>getting hooked up</h2>
          <ol>
            <li>ship the endpoints.</li>
            <li>
              ask someone on the infra team to add your program as a target. tell them its name, the
              audience you hardcoded, and the base url (the yeeter adds{' '}
              <code>/api/privacy/delete</code> itself, so just the bit before that). point it at the
              server your api actually runs on, not your frontend.
            </li>
            <li>
              we can help test dry runs for you against alts you hold to make sure you did it right
            </li>
            <li>profit?</li>
          </ol>

          <h2>reference implementations (steal these)</h2>
          <ul>
            {REFERENCES.map((r) => (
              <li key={r.name}>
                <a href={r.href}>{r.name}</a>: {r.stack}
              </li>
            ))}
          </ul>
        </Prose>
      </Container>
    </SpaceBetween>
  )
}
