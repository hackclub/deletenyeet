import { generateSigningJwk } from '../app/signing/keyring.ts'

let jwk = await generateSigningJwk()
let out = process.argv.includes('--key') ? jwk : { active: jwk.kid, keys: [jwk] }
process.stdout.write(`${JSON.stringify(out)}\n`)
process.stderr.write(
  `generated ${jwk.kid}. this is a private key: store it as a secret, never commit it\n`,
)
