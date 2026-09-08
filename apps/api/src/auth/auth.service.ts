import { randomBytes } from 'node:crypto'
import type { LoginInput, RegisterInput, UpdateAccountInput } from '@blooger/shared'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserEntity } from '../users/user.entity.js'
import { hashPassword, verifyPassword } from './password.js'

/** MySQL's duplicate-key error number. */
const ER_DUP_ENTRY = 1062

function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { errno?: number; driverError?: { errno?: number } }
  return candidate.errno === ER_DUP_ENTRY || candidate.driverError?.errno === ER_DUP_ENTRY
}

@Injectable()
export class AuthService {
  /**
   * Hashed once at construction. `verifyCredentials` compares against it when the
   * username does not exist, so a missing account costs the same wall-clock time
   * as a wrong password and the response cannot be used to enumerate usernames.
   */
  private readonly dummyHash: Promise<string>

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {
    this.dummyHash = hashPassword(randomBytes(32).toString('hex'))
  }

  async register(input: RegisterInput): Promise<UserEntity> {
    const taken = await this.users.findOne({
      where: { username: input.username },
      loadEagerRelations: false,
    })
    if (taken) throw new ConflictException('That username is taken')

    const user = this.users.create({
      username: input.username,
      bloogTitle: input.bloogTitle,
      passwordHash: await hashPassword(input.password),
      isAdmin: false,
    })

    try {
      return await this.users.save(user)
    } catch (error) {
      // The check above is racy. The unique index is the actual guarantee, so a
      // duplicate that slips through still has to surface as a 409, not a 500.
      if (isDuplicateKeyError(error)) throw new ConflictException('That username is taken')
      throw error
    }
  }

  async verifyCredentials(input: LoginInput): Promise<UserEntity> {
    const user = await this.users.findOne({
      where: { username: input.username },
      loadEagerRelations: false,
    })

    const digest = user?.passwordHash ?? (await this.dummyHash)
    const matches = await verifyPassword(digest, input.password)

    // One message for both failure modes, so it never reveals which one happened.
    if (!user || !matches) throw new UnauthorizedException('Incorrect username or password')

    return user
  }

  async updateAccount(user: UserEntity, input: UpdateAccountInput): Promise<UserEntity> {
    if (input.newPassword !== undefined) {
      // Re-authenticate before a password change, so a hijacked session cannot
      // lock the real owner out of their account.
      const correct = await verifyPassword(user.passwordHash, input.currentPassword ?? '')
      if (!correct) throw new BadRequestException('Your current password is incorrect')

      user.passwordHash = await hashPassword(input.newPassword)
    }

    if (input.bloogTitle !== undefined) {
      user.bloogTitle = input.bloogTitle
    }

    return this.users.save(user)
  }
}
