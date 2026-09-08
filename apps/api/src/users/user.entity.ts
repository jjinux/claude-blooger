import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm'
import { PostEntity } from '../posts/post.entity.js'

/**
 * A registered user, who owns exactly one "bloog".
 *
 * Column types are always explicit rather than inferred from reflect-metadata:
 * it survives refactors, and it documents the actual schema at the call site.
 */
@Entity({ name: 'users' })
// Named explicitly; `unique: true` on the column would leave MySQL with an
// opaque auto-generated index name in the schema.
@Index('idx_users_username', ['username'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number

  /**
   * Unique under utf8mb4_0900_ai_ci, which is case- and accent-insensitive,
   * so `Joe` and `joe` cannot both register.
   */
  @Column({ type: 'varchar', length: 64 })
  username!: string

  /** argon2id digest. Never selected into a response DTO. */
  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string

  /** Display title of this user's bloog, e.g. "Joe's Bloog". */
  @Column({ type: 'varchar', length: 128 })
  bloogTitle!: string

  @Column({ type: 'boolean', default: false })
  isAdmin!: boolean

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt!: Date

  /**
   * Optional because nothing is eager-loaded: this is only populated when a query
   * asks for it via `relations: { posts: true }`. Typing it as non-optional would
   * be a lie that TypeScript would happily let us dereference.
   */
  @OneToMany(() => PostEntity, (post) => post.user)
  posts?: Relation<PostEntity[]>
}
