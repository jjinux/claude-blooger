import 'reflect-metadata'
import { hashPassword } from '../auth/password.js'
import { PostEntity } from '../posts/post.entity.js'
import { UserEntity } from '../users/user.entity.js'
import { AppDataSource } from './data-source.js'

/** Fixed so re-seeding produces a stable, predictable ordering. */
const EPOCH = new Date('2026-01-01T12:00:00Z')

function daysAfterEpoch(days: number): Date {
  return new Date(EPOCH.getTime() + days * 24 * 60 * 60 * 1000)
}

const SEED_USERS = [
  { username: 'admin', bloogTitle: "The Management's Bloog", isAdmin: true, postCount: 3 },
  { username: 'joe', bloogTitle: "Joe's Bloog", isAdmin: false, postCount: 12 },
  { username: 'jane', bloogTitle: 'Booger Facts Weekly', isAdmin: false, postCount: 7 },
  // Deliberately postless, so the "There are no bloog posts yet." empty state
  // has something to render against.
  { username: 'quiet', bloogTitle: 'An Empty Bloog', isAdmin: false, postCount: 0 },
] as const

const PASSWORD = 'password123'

async function seed(): Promise<void> {
  const dataSource = await AppDataSource.initialize()

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.')
  }

  try {
    // One hash for every user: argon2 is deliberately slow, and this is fixture data.
    const passwordHash = await hashPassword(PASSWORD)

    await dataSource.transaction(async (manager) => {
      // ON DELETE CASCADE clears posts and sessions along with the users.
      // Note `.delete({})` is rejected in TypeORM 1.x -- an empty criteria object
      // is treated as a mistake rather than as "match everything", so wiping a
      // table has to be spelled out deliberately.
      await manager.createQueryBuilder().delete().from(UserEntity).execute()

      let dayOffset = 0

      for (const spec of SEED_USERS) {
        const user = await manager.getRepository(UserEntity).save(
          manager.getRepository(UserEntity).create({
            username: spec.username,
            bloogTitle: spec.bloogTitle,
            isAdmin: spec.isAdmin,
            passwordHash,
          }),
        )

        for (let n = 1; n <= spec.postCount; n += 1) {
          dayOffset += 1
          const createdAt = daysAfterEpoch(dayOffset)

          await manager.getRepository(PostEntity).save(
            manager.getRepository(PostEntity).create({
              userId: user.id,
              title: `${spec.username} post #${n}`,
              body: [
                `This is **post ${n}** on ${spec.bloogTitle}.`,
                '',
                'It exists so the listing has something to paginate. It uses',
                '_Markdown_, because [the original](https://example.com/) did too.',
                '',
                '- a bullet',
                '- another bullet',
              ].join('\n'),
              createdAt,
              updatedAt: createdAt,
            }),
          )
        }
      }
    })

    const users = await dataSource.getRepository(UserEntity).count()
    const posts = await dataSource.getRepository(PostEntity).count()

    console.log(`Seeded ${users} users and ${posts} posts.`)
    console.log(`Every seeded account uses the password: ${PASSWORD}`)
  } finally {
    await dataSource.destroy()
  }
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
