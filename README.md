# epic data yeeter 9000

Internal Hack Club tool for processing GDPR deletion and export requests across every program.

## Development

Requires Node 24.3+ and Docker.

```sh
bun install
cp .env.example .env  # then fill in SESSION_SECRET and the Hack Club Auth client
npm run db:up         # postgres 18 on 127.0.0.1:54320
npm run dev           # migrates, discovers Hack Club Auth, serves http://localhost:44100
npm run hmr           # same, with live server and browser updates
npm run typecheck
```

## Database

Migrations are plain SQL in `db/migrations/<NNNN>_<name>/{up,down}.sql`, run by `remix/data-table`.
Never edit an applied migration; add a new one.

```sh
npm run db -- status
npm run db -- migrate
npm run db -- rollback
```

Development applies pending migrations at startup. Production refuses to start with pending
migrations unless `MIGRATE_ON_START=true`, which the Docker image sets.

## Configuration

Environment is validated once at startup in `app/env.ts`; the process exits before listening
if anything is missing or malformed. `.env` is loaded only by the dev
and db scripts. Production reads the real environment.

| Variable            | Required | Notes                                                                                            |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`      | yes      | `postgres://`                                                                                    |
| `PORT`              | no       | defaults to 44100                                                                                |
| `APP_ORIGIN`        | yes      | public origin; https in production. The OIDC redirect URI is `<APP_ORIGIN>/auth/callback`        |
| `SESSION_SECRET`    | yes      | 32+ characters, signs the session cookie                                                         |
| `HCA_CLIENT_ID`     | yes      | Hack Club Auth OAuth app                                                                         |
| `HCA_CLIENT_SECRET` | yes      | Hack Club Auth OAuth app                                                                         |
| `HCA_ISSUER`        | no       | defaults to `https://auth.hackclub.com`                                                          |
| `HCA_PKCE`          | no       | `true` by default; set `false` only if Hack Club Auth rejects PKCE                               |
| `STAFF_SUBS`        | prod     | comma separated Hack Club Auth `sub` values allowed to sign in                                   |
| `MIGRATE_ON_START`  | no       | `false` by default; `true` applies pending migrations before listening (set in the Docker image) |
| `SIGNING_KEYS`      | prod     | keyring JSON for program tokens (see Signing). Set this or `SIGNING_KEYS_FILE`, not both         |
| `SIGNING_KEYS_FILE` | prod     | path to the same JSON, e.g. a mounted secret file                                                |

## Deploying (Coolify)

The `Dockerfile` installs production dependencies with Bun and runs the app on a hardened Node 24
image as uid 1000, serving TypeScript directly with no build step. On start it applies pending
migrations, fetches the Hack Club Auth discovery document, and listens on `PORT` (44100). The
image `HEALTHCHECK` calls `/healthz`, which also checks the database.

1. Create a Postgres 18 resource and copy its internal connection URL into `DATABASE_URL`.
2. Add an application from this repo with the Dockerfile build pack and port 44100.
3. Set `APP_ORIGIN` to the public https domain, plus `SESSION_SECRET`, `HCA_CLIENT_ID`,
   `HCA_CLIENT_SECRET`, `STAFF_SUBS`, and `SIGNING_KEYS` (or mount the keyring as a file and set
   `SIGNING_KEYS_FILE`). Register `<APP_ORIGIN>/auth/callback` as the redirect
   URI in Hack Club Auth.
4. Run one replica. Migrations run at boot without a lock.

TLS ends at Coolify's proxy, so in production every request URL is pinned to `APP_ORIGIN`
instead of trusting forwarded headers. CSRF and cross-origin checks compare against that
origin, so a wrong `APP_ORIGIN` rejects every POST with 403.

## Data model

`db/migrations/0003_create_request_model` adds:

- `requests`: type, lifecycle status, source (manual or an Airtable record), and the approval
  decision (who, from where, when).
- `request_identifiers`: emails (stored lowercased), identity IDs, and Slack IDs per request.
  `hashed` marks values the retention job has replaced.
- `targets`: the registry, one row per program or system, with `slug`, `type`, `audience`, and
  non-secret `config`.
- `target_results`: one row per request, target, and phase (`dry_run` or `execute`), with
  status, attempts, counts, and an error code. Target response bodies are never stored.

All of this is in addition to the existing `audit_events`.

Constraints enforce the rules that must never break. A request cannot be executing or done
without an `approved` decision. A failed result must carry an error code. A retrying result must
have a next attempt time. Status changes go through `app/data/requests.ts`, which only allows
the lifecycle's transitions, checks the current status in the `UPDATE`, and writes the audit row
in the same transaction.

## Signing

The hub signs one ES256 token per request, target, action, and attempt, which programs verify
against `/.well-known/jwks.json` (public, cached 5 minutes). The keyring is JSON:

```json
{ "active": "<kid>", "keys": [<EC P-256 JWK with kid>, ...] }
```

Every key is published. Only `active` signs and must include the private `d`. At startup the
keyring is validated: P-256 only, unique kids, and every private key must match its public half.
Private keys are imported non-extractable and never logged or stored. Development uses an
ephemeral key when neither variable is set.

```sh
npm run keys:generate          # a new keyring with one key, on stdout
npm run keys:generate -- --key # a single new JWK, for rotation
```

To rotate:

1. Add the new JWK to `keys` and deploy. It is published but not yet used.
2. After programs' JWKS caches refresh (5 minutes or more), make it `active` and deploy.
3. After another 5 minutes, outstanding tokens have expired. Remove the old key, or keep only
   its public half.

Tokens also carry a `request_id` claim so programs can echo it without parsing `jti`. The
attempt in `jti` counts every call to that target for the request, across dry run and
execution, so a real run never reuses a dry run's `jti`.

`app/signing/tokens.ts` holds `mintTargetToken` and `verifyTargetToken`. The verifier runs the
checks a program should run: ES256 only, `kid` from the JWKS, `typ: JWT`, `iss`, `aud`, `exp`,
`iat`, and lifetime at most 300 seconds, plus the shape of `action`, `dry_run`, and `subject`.

## Request flow

1. **Create.** Staff create a request at `/requests/new` with an email and, until Hack Club Auth
   lookup lands, any Slack or identity ID they know.
2. **Resolve.** A `request-resolve` job runs the resolver (a stub for now).
3. **Dry run.** The resolver fans out a dry run to every enabled target: one `target_results`
   row and one `target-call` job per target.
4. **Review.** When every dry run has answered, the request waits for approval. The review page
   shows each target's counts, retained items, and errors. Approval is blocked while any dry run
   has failed; "Re-run failed" retries those.
5. **Execute.** Approving creates execution rows for exactly the targets that were reviewed and
   fans out again. The request ends `completed`, or `partially_failed` if any target failed.

Target calls:

- **Source of truth.** The `target_results` row is the record; pg-boss jobs only wake a worker.
  A worker claims a row with a compare-and-set and a 60 second lease, so duplicate or late jobs
  do nothing.
- **Retries.** Network errors, timeouts, 408, 425, 429 and 5xx retry with backoff (10s, 30s,
  90s, 270s) up to 5 attempts. Any other 4xx or a malformed response fails at once.
- **Failure.** Every failure ends as `failed` with an error code. Response bodies are never
  stored or logged.
- **Recovery.** A `flow-sweep` job runs every minute. It re-sends lost jobs, recovers expired
  leases, and finishes any phase whose last result landed without moving the request.
- **Audit.** Every status change, retry and result is audited.

pg-boss keeps its tables in the `pgboss` schema of the same database and creates them on start.
Workers run in the web process.

### Fake target

In development the server also starts a fake program on `127.0.0.1:44199`
(`FAKE_TARGET_PORT`). It verifies tokens against the hub's JWKS like a real program. The first
path segment picks a behaviour:

- `ok`
- `flaky`: 503 until every third attempt
- `down`: always 500
- `reject`: 401
- `missing`: found false

"Add fake targets" on `/targets` registers one of each. Only `ok` and `flaky` are enabled.

### Demo with a local Summer of Making

A separate clone at `../summer-of-making-privacy-demo` (branch `privacy-endpoint`) implements the
program side:

- `Api::PrivacyController` and `Privacy::Token` verify ES256 with Ruby's OpenSSL, so it needs no
  new gems.
- `Privacy::Eraser` finds users by email, Slack ID, or identity ID.
- A migration makes user-owned foreign keys `ON DELETE CASCADE`, and financial, fraud, vote, and
  review foreign keys `SET NULL`. Those records are reported as retained with a reason.
- A dry run performs the real deletion in a transaction, reads `pg_stat_xact_user_tables`, and
  rolls back, so its counts match execution exactly.

```sh
cd ../summer-of-making-privacy-demo
docker compose up -d   # web on :3000, JWKS from host.docker.internal:44100
```

Then register a target with slug and audience `summer-of-making` and base URL
`http://127.0.0.1:3000`.

## Design system

Server-rendered components live in `app/ui/`: one function per component, all CSS in
`app/ui/public/app.css`, no CSS framework. Colors, spacing, and type come from
`app/ui/public/tokens.css`, generated by `npm run tokens` from `@cloudscape-design/design-tokens`
(visual refresh, compact density, Lexend, dark surfaces remapped to AMOLED black). Do not edit
`tokens.css` by hand. Signed-in staff see every component at `/dev/components` in development
only. It is not mapped in production.

## Logging

Never log email addresses, identifiers, tokens, or keys. Request logs print the path without its
query string. Unhandled errors go through `app/log.ts`, which prints error names, codes, and stack
frames but drops messages unless the error is a `SafeError` whose message we wrote.

## Sign-in

Staff sign in with Hack Club Auth over OIDC (`openid profile` only). Endpoints come from the
discovery document at startup. The callback verifies `state`, then the ID token's RS256
signature against the issuer JWKS, `iss`, `aud` (and `azp` when there are several audiences),
`exp`, and `nonce`, and checks that userinfo returns the same `sub`. Signing in is not enough:
the `sub` must be in `STAFF_SUBS`, checked again on every request, so removing someone takes
effect immediately. An account that is not allowlisted sees its `sub` so it can be added.

Sessions live in Postgres (`sessions`, keyed by a SHA-256 of the session id) for 12 hours after
the last change, and are pruned hourly. Every route requires an allowlisted session except
`/login`, `/auth/callback`, `/healthz`, and `/assets/*`. Every POST needs a CSRF token and a
same-origin `Origin`. Sign-ins, denials, failures (with a reason code), and sign-outs are audited.
