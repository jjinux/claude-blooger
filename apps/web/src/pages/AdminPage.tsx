import { Link } from 'react-router'
import { useAdminPosts, useAdminUsers, useCurrentUser, useDeleteUser } from '../api/queries'
import { formatDate } from '../components/PostCard'
import { Button, EmptyState, ErrorState, Pagination, Spinner } from '../components/ui'
import { usePageParam } from './hooks'

function UsersTable() {
  const page = usePageParam()
  const { data, error, isPending, refetch } = useAdminUsers(page)
  const me = useCurrentUser()
  const remove = useDeleteUser()

  async function handleDelete(id: number, username: string) {
    if (!window.confirm(`Delete ${username} and every post they have written?`)) return
    await remove.mutateAsync(id)
  }

  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!data) return null

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">
                User
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Bloog
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Posts
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Joined
              </th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.items.map((user) => (
              <tr key={user.id}>
                <td className="py-3 pr-4">
                  <Link to={`/bloogs/${user.username}`} className="font-medium hover:underline">
                    {user.username}
                  </Link>
                  {user.isAdmin && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                      admin
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{user.bloogTitle}</td>
                <td className="py-3 pr-4 tabular-nums">{user.postCount}</td>
                <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                  {formatDate(user.createdAt)}
                </td>
                <td className="py-3 text-right">
                  {/* The API refuses this too; hiding it avoids an error people
                      cannot act on. */}
                  {user.id !== me?.id && (
                    <Button
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      disabled={remove.isPending}
                      onClick={() => void handleDelete(user.id, user.username)}
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {remove.error && (
        <div className="mt-4">
          <ErrorState error={remove.error} />
        </div>
      )}

      <div className="mt-8">
        <Pagination
          page={data.page}
          hasPrevious={data.hasPrevious}
          hasNext={data.hasNext}
          hrefFor={(next) => (next === 1 ? '/admin' : `/admin?page=${next}`)}
        />
      </div>
    </>
  )
}

function RecentPosts() {
  const { data, error, isPending } = useAdminPosts(1)

  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} />
  if (!data) return null
  if (data.items.length === 0) return <EmptyState>No posts yet.</EmptyState>

  return (
    <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
      {data.items.map((post) => (
        <li key={post.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5">
          <Link
            to={`/bloogs/${post.author.username}/posts/${post.id}`}
            className="font-medium hover:underline"
          >
            {post.title}
          </Link>
          <span className="text-slate-500 dark:text-slate-400">
            by {post.author.username} · {formatDate(post.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function AdminPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Users</h2>
        <div className="mt-4">
          <UsersTable />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Recent posts</h2>
        <div className="mt-4">
          <RecentPosts />
        </div>
      </section>
    </>
  )
}
