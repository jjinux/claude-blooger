import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm'
import { UserEntity } from '../users/user.entity.js'

/**
 * Server-side session. The cookie carries only this opaque id, so a session can
 * be revoked by deleting the row -- the reason this project uses sessions rather
 * than JWTs.
 *
 * Backs a hand-written express-session store. `connect-typeorm` is not usable
 * here: it was last published in 2022 and its peer dependency is `typeorm ^0.3.0`.
 */
@Entity({ name: 'sessions' })
export class SessionEntity {
  /** Opaque random id, also the express-session `sid`. */
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string

  /** Null for a session belonging to an anonymous visitor. */
  @Column({ type: 'int', unsigned: true, nullable: true })
  userId!: number | null

  /** Deleting a user revokes every session they hold, at the database level. */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<UserEntity> | null

  /** Indexed so expired-session sweeps do not table-scan. */
  @Index('idx_sessions_expires_at')
  @Column({ type: 'datetime', precision: 6 })
  expiresAt!: Date

  /** Serialized express-session payload. */
  @Column({ type: 'text' })
  data!: string
}
