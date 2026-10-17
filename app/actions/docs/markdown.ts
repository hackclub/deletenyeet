import {
  JWKS_URL,
  PROMPT,
  TOKEN_EXAMPLE,
  VERIFY_EXAMPLE,
  RESPONSE_EXAMPLE,
  REPLAY_EXAMPLE,
  REFERENCES,
} from './content.ts'

export const deletionsMarkdown = `# how to yeet data properly

this easy guide will help satisfy karens worldwide

> be the hack club infra guy
> someone asks for their data to be deleted
> roll your own SQL scripts against program dbs
> pray it dont break anything

help us not have to do that. instead, implement just two endpoints to your program, we handle the rest! save us from having to run arbitrary SQL against your database, and save yourself from dealing with the #fallout.

### the short version, if you've never built an api

- you add two urls to your app that the yeeter can POST to.
- every call comes with a token. a token is a signed note from the yeeter that says "this person, this action, signed by the right people". a library checks the signature for you, so nobody can fake one. you don't need to understand the crypto.
- you find the person in your database using the details inside the token.
- first call is a practice run to make sure everything works as expected: say what you *would* delete and change nothing. a human checks to make sure this is legit and the second call is the real deletion.
- you answer with counts, never with their personal data.

## let your agent do it

if you use a coding agent, copy this prompt, paste it in your repo, and review what it builds. it will ask you for your audience and walk you through what gets deleted before writing anything. you still own the result, so read this page anyway.

\`\`\`text
${PROMPT}
\`\`\`

## how a request plays out

- someone asks Hack Club to delete their data, and it lands in the yeeter.
- the yeeter calls \`/api/privacy/delete\` on every program with \`dry_run: true\`. you work out exactly what you'd delete and keep, report the counts, and change **nothing**.
- staff read every program's counts. if something looks off (you'd delete 40,000 comments for one person?) they stop here and nothing has been touched.
- once they approve, the yeeter calls the same endpoint again with \`dry_run: false\`. now you actually delete, and report what you removed.

the dry run and the real run should give the same numbers. the reviewer approved those numbers, so surprising them in the real run is bad.

## the endpoints

- \`POST /api/privacy/delete\` nukes everything that belongs to the person. on a dry run it just tells us what it *would* nuke.
- \`POST /api/privacy/export\` tells us what you have on them. we are not sure how to operate exports yet, so this one should never change anything.

we hit your url with \`Authorization: Bearer <token>\` and \`Accept: application/json\`, no body. we will give up after **15 seconds** and we don't follow redirects.

## the token

every request gets a fresh ES256 JWT that lives for 5 minutes max. it's bound to your epic program. here's what one looks like:

a decoded token

\`\`\`json
${TOKEN_EXAMPLE}
\`\`\`

- \`aud\` is your program's audience. more on that right below.
- \`request_id\` is the only thing from this you should log. seriously.
- \`dry_run\` is \`true\` on the practice run and \`false\` on the real one. if it's \`true\`, your database must look exactly the same after the call as before it.
- \`jti\` is unique per call, retries included.

### the audience

the audience is just a string that names your program, like \`flavortown\`. it's what stops a token meant for one program from working on another. two places have to agree on it:

- **the yeeter.** staff type it in when they add your program as a target.
- **your code.** you hardcode the same string in your token check.

it has to match **exactly**. \`summer-of-making\`, \`summer_of_making\`, and \`Summer of Making\` are three different audiences. to keep it boring, use lowercase letters and hyphens, and tell us what you picked when you ask to be added. if they don't match, every call fails with a \`401\` and nothing gets deleted, so it's annoying but not dangerous.

## verifying it

### do NOT skip this

this check is the only thing stopping a random person on the internet from deleting your users. use a jwt library (like \`jose\` for js, \`ruby-jwt\` for ruby, \`pyjwt\` for python) and do every step below. ask us if anything is unclear.

- grab the public keys from \`${JWKS_URL}\`. cache them for ~5 minutes, and refetch (at most every 30 seconds or so) when a token names a \`kid\` you haven't seen. that way key rotation just works and you never hear about it.
- only accept \`alg: ES256\` with \`typ: JWT\`, and check the signature against the key that \`kid\` names. if your jwt library lets you skip the alg check, don't.
- \`iss\` must be \`hackclub-privacy\` and \`aud\` must be exactly your audience.
- check \`exp\` and \`iat\` with ~30 seconds of leeway, and reject anything where \`exp − iat\` is over 300 seconds.
- \`action\` has to match the endpoint that got called. a delete token sent to \`/export\` is a 400.
- record the \`jti\` and reject repeats. put it in your database, not a cache. ask us how we know: some cache clients report a failed write the same way as "key already exists", so every token looks replayed and you get a wall of 409s.
- only trust the claims. never read identifiers from the body or query string. if anyone can POST you an email and get it deleted, that's not a feature.

verifying a token with jose

\`\`\`js
${VERIFY_EXAMPLE}
\`\`\`

remembering which tokens you've seen

\`\`\`sql
${REPLAY_EXAMPLE}
\`\`\`

if you do make the jwks url overridable with an env var, thats cool but make sure it defaults to the real one.

## finding the person

- \`emails\` come lowercased from the yeeter. compare them case-insensitively against every email column you have on them, including the weird secondary one you forgot about.
- \`slack_id\` and \`identity_id\` (the Hack Club Auth \`ident!…\` id) can be \`null\` since we dont always have them. if they are present, match them against your records too.
- no match? return \`200\` with \`found: false\` and we wont bug you again about this person.

## deleting stuff

- **delete what's theirs.** account, profile, content, uploads, sessions, login identities, analytics, and any versioning or audit rows that copy their data. yes, paper_trail counts.
- **keep what other people depend on, detached.** orders, payouts, ledger entries, fraud reports, and votes that affect other people's rankings can stay. null the user reference, or keep an anonymous placeholder row with every personal field wiped. list each kind in \`retained\` with a reason a reviewer would actually buy.
- **close open work.** cancel unfulfilled orders and pending payouts or anything outstanding.
- **fix other people's numbers.** recount likes, comments, followers, and votes on stuff you didn't delete.
- **external storage goes first.** delete files in s3 or rows in other databases before you commit the main transaction. if that blows up, the retry still finds the person and finishes the job.
- **one code path for both runs.** the best dry run does the real deletion inside a transaction, counts what it removed, and rolls back. the numbers a reviewer approves are then the numbers that actually run. a separate "count what we'd delete" function will drift and lie to you eventually.
- **refuse what needs a human.** if the account owns something only staff should decide about, like api keys other services depend on, return \`409\` with \`manual_review_required\` instead of guessing.

## what to send back

a dry run response

\`\`\`json
${RESPONSE_EXAMPLE}
\`\`\`

- echo \`request_id\` and \`dry_run\` exactly as the token had them. the yeeter rejects responses that don't.
- \`deleted\` maps a table or record type (100 characters max) to a non-negative row count.
- each \`retained\` entry has a \`type\` (100 characters max), a \`count\`, and a \`reason\` (500 characters max).
- dont send back pii in the response, just the counts and reasons.

## errors and retries

errors look like \`{"error": "snake_case_code"}\`. staff see it as something like \`http_409_replayed\`, so keep it short and snappy!

- \`408\`, \`425\`, \`429\`, \`500\`, \`502\`, \`503\`, \`504\`, timeouts, and network errors get retried after 10, 30, 90, and 270 seconds. after 5 attempts it's marked failed.
- anything else fails immediately and shows up for staff. \`401\` for a bad token, \`400 action_mismatch\`, \`409 replayed\`, and \`409 manual_review_required\`.
- \`503\` when something you depend on, like the jwks or s3, is having a moment, so the yeeter tries again.

## logging

log the \`request_id\` and the outcome. **do not log the token, emails, slack or identity ids, or anything you deleted.** logging the email of the person who asked to be forgotten is peak irony. please don't do it.

## getting hooked up

- ship the endpoints.
- ask someone on the infra team to add your program as a target. tell them its name, the audience you hardcoded, and the base url (the yeeter adds \`/api/privacy/delete\` itself, so just the bit before that). point it at the server your api actually runs on, not your frontend.
- we can help test dry runs for you against alts you hold to make sure you did it right
- profit?

## reference implementations (steal these)

${REFERENCES.map((r) => `- [${r.name}](${r.href}): ${r.stack}`).join('\n')}
`
