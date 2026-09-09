import { describe, expect, it } from 'vitest'
import { ARGON2_OPTIONS, hashPassword, verifyPassword } from './password.js'

/**
 * argon2id is deliberately slow -- 19 MiB and two passes per call -- so this file
 * hashes as few times as it can get away with.
 */
describe('password hashing', () => {
  const PASSWORD = 'correct horse battery staple'

  it('produces an argon2id digest carrying the OWASP parameters', async () => {
    const digest = await hashPassword(PASSWORD)

    // The parameters are encoded in the digest itself, which is what lets an
    // existing hash still verify after the cost is raised. Asserting on them here
    // means a change to ARGON2_OPTIONS cannot pass unnoticed.
    expect(digest.startsWith('$argon2id$')).toBe(true)
    expect(digest).toContain(`m=${ARGON2_OPTIONS.memoryCost}`)
    expect(digest).toContain(`t=${ARGON2_OPTIONS.timeCost}`)
    expect(digest).toContain(`p=${ARGON2_OPTIONS.parallelism}`)
  })

  it('salts, so the same password never hashes to the same digest twice', async () => {
    const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)])

    expect(first).not.toBe(second)
    // Both still verify: the salt travels inside the digest.
    expect(await verifyPassword(first, PASSWORD)).toBe(true)
    expect(await verifyPassword(second, PASSWORD)).toBe(true)
  })

  it('accepts the right password and refuses everything else', async () => {
    const digest = await hashPassword(PASSWORD)

    expect(await verifyPassword(digest, PASSWORD)).toBe(true)
    expect(await verifyPassword(digest, 'correct horse battery stapl')).toBe(false)
    expect(await verifyPassword(digest, PASSWORD.toUpperCase())).toBe(false)
    expect(await verifyPassword(digest, '')).toBe(false)
    expect(await verifyPassword(digest, ` ${PASSWORD}`)).toBe(false)
  })

  /**
   * Login compares an unknown username against a dummy hash to keep the timing
   * even. That only works if a malformed or truncated digest returns false
   * instead of throwing -- an exception would produce a 500 and turn the endpoint
   * back into the username oracle the dummy hash exists to prevent.
   */
  it.each([
    ['empty', ''],
    ['not a digest at all', 'hunter2'],
    ['truncated', '$argon2id$v=19$m=19456,t=2,p=1$'],
    ['a bcrypt digest', '$2b$12$abcdefghijklmnopqrstuv'],
  ])('returns false rather than throwing for %s', async (_name, digest) => {
    await expect(verifyPassword(digest, PASSWORD)).resolves.toBe(false)
  })

  it('handles a long unicode password unchanged', async () => {
    const password = `🔐 ${'ünïcødé '.repeat(20)}`
    const digest = await hashPassword(password)

    expect(await verifyPassword(digest, password)).toBe(true)
    expect(await verifyPassword(digest, password.trim())).toBe(false)
  })
})
