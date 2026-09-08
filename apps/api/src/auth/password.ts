import { argon2id, hash, verify } from 'argon2'

/**
 * OWASP's baseline argon2id parameters: 19 MiB of memory, 2 iterations, 1 lane.
 * Kept in one place so raising the cost later is a single-line change, and so no
 * call site can accidentally hash with weaker settings.
 */
export const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS)
}

/** Returns false rather than throwing on a malformed digest. */
export async function verifyPassword(digest: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(digest, plaintext)
  } catch {
    return false
  }
}
