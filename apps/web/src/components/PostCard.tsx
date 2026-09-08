import type { PostSummary } from '@blooger/shared/contracts'
import { Link } from 'react-router'
import { PostBody } from './PostBody'

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function PostCard({ post, showAuthor = true }: { post: PostSummary; showAuthor?: boolean }) {
  const permalink = `/bloogs/${post.author.username}/posts/${post.id}`

  return (
    <article className="border-b border-line pb-8 last:border-b-0">
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        <Link to={permalink} className="hover:text-accent">
          {post.title}
        </Link>
      </h2>

      <p className="mt-1 text-sm text-ink-faint">
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        {showAuthor && (
          <>
            {' · '}
            <Link to={`/bloogs/${post.author.username}`} className="hover:underline">
              {post.author.bloogTitle}
            </Link>
          </>
        )}
      </p>

      <div className="mt-4">
        <PostBody html={post.bodyHtml} />
      </div>
    </article>
  )
}
