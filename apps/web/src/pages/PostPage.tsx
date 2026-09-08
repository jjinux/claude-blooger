import { Link, useNavigate, useParams } from 'react-router'
import { useCurrentUser, useDeletePost, usePost } from '../api/queries'
import { formatDate } from '../components/PostCard'
import { PostBody } from '../components/PostBody'
import { Button, ButtonLink, ErrorState, Spinner } from '../components/ui'

export function PostPage() {
  const { id: rawId = '' } = useParams()
  const id = Number(rawId)
  const { data: post, error, isPending, refetch } = usePost(id)

  const user = useCurrentUser()
  const remove = useDeletePost()
  const navigate = useNavigate()

  // Mirrors the server's rule; the API is what actually enforces it.
  const mayEdit = user !== null && post !== undefined && (user.isAdmin || user.username === post.author.username)

  async function handleDelete() {
    if (!post) return
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return

    await remove.mutateAsync(post.id)
    void navigate(`/bloogs/${post.author.username}`)
  }

  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (!post) return null

  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>

      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        {' · '}
        <Link to={`/bloogs/${post.author.username}`} className="hover:underline">
          {post.author.bloogTitle}
        </Link>
      </p>

      <div className="mt-6">
        <PostBody html={post.bodyHtml} />
      </div>

      {mayEdit && (
        <div className="mt-10 flex gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
          <ButtonLink to={`/posts/${post.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
          <Button variant="danger" onClick={() => void handleDelete()} disabled={remove.isPending}>
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}

      {remove.error && (
        <div className="mt-4">
          <ErrorState error={remove.error} />
        </div>
      )}
    </article>
  )
}
