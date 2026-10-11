import { generateSigningJwk } from '../app/signing/keyring.ts'

let jwk = await generateSigningJwk()

if (process.argv.includes('--key')) {
  process.stdout.write(`${JSON.stringify(jwk)}\n`)
} else {
  process.stdout.write(`${JSON.stringify({ active: jwk.kid, keys: [jwk] })}\n`)
}
process.stderr.write(`generated ${jwk.kid}. this is a private key: store it as a secret, never commit it\n`)
