import type { PublicUser } from '@blooger/shared'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { UserEntity } from './user.entity.js'

/** Strips everything the outside world has no business seeing, notably the hash. */
export function toPublicUser(user: UserEntity): PublicUser {
  return {
    id: user.id,
    username: user.username,
    bloogTitle: user.bloogTitle,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  findById(id: number): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id }, loadEagerRelations: false })
  }

  /**
   * Case-insensitive by virtue of the utf8mb4_0900_ai_ci collation on the column,
   * so logging in as "Joe" finds the account registered as "joe".
   */
  findByUsername(username: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { username }, loadEagerRelations: false })
  }
}
