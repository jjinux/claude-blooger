import { describe, expect, it } from 'vitest'
import { snakeCase } from './naming.strategy.js'

describe('snakeCase', () => {
  it.each([
    ['bloogTitle', 'bloog_title'],
    ['passwordHash', 'password_hash'],
    ['id', 'id'],
    ['createdAt', 'created_at'],
    ['isAdmin', 'is_admin'],
    // Consecutive capitals split before the final capitalised word, not between
    // every letter: APIKey -> api_key, never a_p_i_key.
    ['APIKey', 'api_key'],
    ['userID', 'user_id'],
    ['user.profile', 'user_profile'],
  ])('maps %s to %s', (input, expected) => {
    expect(snakeCase(input)).toBe(expected)
  })
})
