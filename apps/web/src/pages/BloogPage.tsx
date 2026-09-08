import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useBloog } from '../api/queries'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorState, Pagination, Spinner } from '../components/ui'
import { usePageParam } from './hooks'

/**
 * Adds this bloog's feed to <head> while the page is open, so a reader's
 * autodiscovery finds the per-bloog feed rather than only the site-wide one.
 */
function useFeedAutodiscovery(username: string | undefined, title: string | undefined) {
  useEffect(() => {
    if (!username) return

    const link = document.createElement('link')
    link.rel = 'alternate'
    link.type = 'application/atom+xml'
    link.title = title ? `${title} (Atom)` : 'Atom'
    link.href = `/bloogs/${username}/feed.atom`
    document.head.append(link)

    return () => link.remove()
  }, [username, title])
}

export function BloogPage() {
  const { username = '' } = useParams()
  const page = usePageParam()
  const { data, error, isPending, refetch } = useBloog(username, page)

  useFeedAutodiscovery(username, data?.bloog.bloogTitle)

  return (
    <>
      {isPending && <Spinner />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <>
          <header className="border-b border-line pb-6">
            <h1 className="text-3xl font-bold tracking-tight">{data.bloog.bloogTitle}</h1>
            <p className="mt-2 text-sm text-ink-faint">
              by {data.bloog.username} ·{' '}
              <a href={`/bloogs/${data.bloog.username}/feed.atom`} className="hover:underline">
                Atom feed
              </a>
            </p>
          </header>

          <div className="mt-8">
            {data.posts.items.length === 0 ? (
              <EmptyState>There are no bloog posts yet.</EmptyState>
            ) : (
              <>
                <div className="space-y-8">
                  {data.posts.items.map((post) => (
                    <PostCard key={post.id} post={post} showAuthor={false} />
                  ))}
                </div>
                <div className="mt-10">
                  <Pagination
                    page={data.posts.page}
                    hasPrevious={data.posts.hasPrevious}
                    hasNext={data.posts.hasNext}
                    hrefFor={(next) =>
                      next === 1 ? `/bloogs/${username}` : `/bloogs/${username}?page=${next}`
                    }
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
