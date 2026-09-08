import { usePosts } from '../api/queries'
import { PostCard } from '../components/PostCard'
import { EmptyState, ErrorState, Pagination, Spinner } from '../components/ui'
import { usePageParam } from './hooks'

export function HomePage() {
  const page = usePageParam()
  const { data, error, isPending, refetch } = usePosts(page)

  return (
    <>
      <h1 className="sr-only">Recent posts</h1>

      {isPending && <Spinner />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState>There are no bloog posts yet.</EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-8">
            {data.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <div className="mt-10">
            <Pagination
              page={data.page}
              hasPrevious={data.hasPrevious}
              hasNext={data.hasNext}
              hrefFor={(next) => (next === 1 ? '/' : `/?page=${next}`)}
            />
          </div>
        </>
      )}
    </>
  )
}
