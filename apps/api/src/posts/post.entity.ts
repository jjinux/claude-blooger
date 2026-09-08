import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm'
import { UserEntity } from '../users/user.entity.js'

@Entity({ name: 'posts' })
// Drives the site-wide homepage listing.
@Index('idx_posts_created_at', ['createdAt'])
// Drives one bloog's paginated post list.
@Index('idx_posts_user_id_created_at', ['userId', 'createdAt'])
export class PostEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number

  /**
   * The FK is mapped as a plain column as well as a relation, so `post.userId` is
   * readable without loading the user. Both map to the same `user_id` column.
   */
  @Column({ type: 'int', unsigned: true })
  userId!: number

  /**
   * Note `nullable: false`: in TypeORM 1.x that makes this an INNER JOIN when
   * loaded through `relations`, not the LEFT JOIN 0.3 used. A post whose author
   * row is gone would drop out of results entirely rather than arrive with
   * `user: null` -- which the ON DELETE CASCADE below makes unreachable anyway.
   */
  @ManyToOne(() => UserEntity, (user) => user.posts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  // `Relation<T>` is a no-op alias whose only job is to stop emitDecoratorMetadata
  // from emitting an eager `design:type` reference to UserEntity. Without it, the
  // users <-> posts import cycle throws "Cannot access 'UserEntity' before
  // initialization" at startup under ESM.
  @JoinColumn({ name: 'user_id' })
  user?: Relation<UserEntity>

  @Column({ type: 'varchar', length: 255 })
  title!: string

  /** Markdown source. The rendered, sanitized HTML is derived, never stored. */
  @Column({ type: 'text' })
  body!: string

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt!: Date

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt!: Date
}
