# epic data yeeter 9000

automate the deletion and export of personal data across every Hack Club program instead of handrolling SQL scripts. this is a fully built remix 3 app so its fast and easy to deploy. ui inspired by [aws cloudscape](https://cloudscape.design/).

## adding your program

refer to the lovely docs: [yeet.hackclub.com/docs/deletions](https://yeet.hackclub.com/docs/deletions)

## local dev

```sh
bun install
cp .env.example .env  # then fill in SESSION_SECRET and the Hack Club Auth client
bun db:up         # postgres 18 on 127.0.0.1:54320
bun dev           # migrates, discovers Hack Club Auth, serves http://localhost:44100
bun hmr           # same but with hmr
```

## db

migrations are plain SQL in `db/migrations/<NNNN>_<name>/{up,down}.sql`, run by [remix/data-table](https://api.remix.run/api/remix/data-table/overview/).

```sh
bun db -- status
bun db -- migrate
bun db -- rollback
```

## config

we check the config once at startup in `app/env.ts`; if we find something funny we quit that johnson.

| var                 | needed | notes                                                                                            |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`      | yes    | self explanatory                                                                                 |
| `PORT`              | no     | defaults to 44100                                                                                |
| `APP_ORIGIN`        | yes    | public origin, the OIDC redirect URI is `<APP_ORIGIN>/auth/callback`                             |
| `SESSION_SECRET`    | yes    | 32+ characters, signs the session cookie                                                         |
| `HCA_CLIENT_ID`     | yes    | [auth.hackclub.com/docs/oidc-guide](https://auth.hackclub.com/docs/oidc-guide)                   |
| `HCA_CLIENT_SECRET` | yes    | [auth.hackclub.com/docs/oidc-guide](https://auth.hackclub.com/docs/oidc-guide)                   |
| `STAFF_SUBS`        | prod   | comma separated HCA IDs allowed to sign in to the fancy panel                                    |
| `MIGRATE_ON_START`  | no     | `false` by default; `true` applies pending migrations before listening (set in the Docker image) |
| `SIGNING_KEYS`      | prod   | keyring JSON for program tokens (see Signing). Set this or `SIGNING_KEYS_FILE`, not both         |
