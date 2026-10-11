# Deletenyeet Agent Guide

This app was scaffolded with `remix new`. Use these conventions when continuing to build it out.

## Commands

```sh
bun install
npm run db:up
npm run dev
npm run hmr
npm run start
npm run typecheck
npm run db -- status | migrate | rollback
```

Use `npm run hmr` for live server and browser updates; `npm run dev` only watches and restarts the server. `npm run start` runs in production mode without a separate build step and refuses to start with pending migrations.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md for the Remix mental model and how to find guides and API READMEs through `node_modules/remix/INDEX.md`.

## Starter Layout

- `app/routes.ts` defines the shared route contract used by server and browser modules for type-safe hrefs
- `app/router.ts` wires routes to controllers and installs the standard Remix component renderer used by actions
- Put top-level route actions in `app/actions/controller.tsx`; add `app/actions/<route-key>/controller.tsx` for nested route maps
- `app/actions/document.tsx` is the HTML shell (Lexend, stylesheet, scripts); staff pages wrap their content in `StaffPage` from `app/ui/staff-page.tsx`
- `app/ui/` holds the design system: each component is a function that returns markup and uses only class names styled in `app/ui/public/app.css` (no inline `css()` mixins). Use token variables from `app/ui/public/tokens.css`, which `npm run tokens` regenerates, and never edit it by hand. Blue is only for primary actions and links; red and green are only for status. Everything must work without JavaScript (links, GET forms, popover, checkbox state)
- `app/actions/dev/` serves `/dev/components` and is mapped only when `NODE_ENV=development`; add new components there
- `app/actions/public/` contains the browser runtime entry
- `app/env.ts` validates the environment at startup; `app/db.ts` owns the Postgres connection and migrations
- `app/data/tables.ts` holds `data-table` definitions; keep them aligned with `db/migrations/`
- Change request status only through `transitionRequest` / `decideRequest` in `app/data/requests.ts`. They enforce the lifecycle and write the audit row in the same transaction. Never put emails or identifiers in audit `detail`
- `app/flow/flow.ts` is the request state machine at runtime: fan-out, claimed target calls with retries, phase completion, and the sweeper. `app/jobs/` owns pg-boss (queues, workers started from `server.ts`). Keep `target_results` the source of truth and jobs as triggers only
- `app/targets/` holds the `Target` interface and the implementations by type (only `endpoint` so far); `buildTarget` maps a registry row to one. Target errors are `TargetCallError(code, retryable)`, and codes are short snake_case with no personal data
- `app/dev/fake-target.ts` is a development-only stand-in program on `FAKE_TARGET_PORT`
- `app/signing/` loads the keyring (`keys.ts`, validated at import), mints program tokens, and has the reference verifier. Never log or persist private keys or minted tokens
- `app/auth/` holds the Hack Club Auth OIDC provider, Postgres session storage, and the staff allowlist; `app/middleware/require-staff.ts` denies by default, so new public routes must be added to its `publicRoutes` list in `app/router.ts`
- The project has no automated tests by choice; verify changes by running the app
- `app/log.ts` is the only way to log errors; never log emails, identifiers, tokens, or keys
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and render middleware
- Root `public/` contains static files served unchanged from the app root

This starter intentionally begins small; add directories like `test/` only when you need them.
