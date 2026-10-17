import { routes } from '../../routes.ts'

export const JWKS_URL = 'https://yeet.hackclub.com/.well-known/jwks.json'
const DOCS_URL = `https://yeet.hackclub.com${routes.docs.deletions.href()}?agents`

export const PROMPT = `Add the Hack Club data yeeter endpoints to this codebase. The spec is at ${DOCS_URL}. Read all of it before you start.

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

export const TOKEN_EXAMPLE = `// header
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

export const VERIFY_EXAMPLE = `import { createRemoteJWKSet, jwtVerify } from 'jose'

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

export const RESPONSE_EXAMPLE = `{
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

export const REPLAY_EXAMPLE = `create table privacy_token_uses (
  jti text primary key,
  used_at timestamptz not null default now()
);

-- first use when this inserts a row; a replay inserts nothing
insert into privacy_token_uses (jti) values ($1) on conflict do nothing;

-- prune rows far older than any token can live
delete from privacy_token_uses where used_at < now() - interval '1 day';`

export const REFERENCES = [
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
