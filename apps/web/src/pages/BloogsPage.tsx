import { Link } from 'react-router'
import { useBloogs } from '../api/queries'
import { formatDate } from '../components/PostCard'
import { EmptyState, ErrorState, Pagination, Spinner } from '../components/ui'
import { usePageParam } from './hooks'

export function BloogsPage() {
  const page = usePageParam()
  const { data, error, isPending, refetch } = useBloogs(page)

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Bloogs</h1>

      <div className="mt-8">
        {isPending && <Spinner />}
        {error && <ErrorState error={error} onRetry={() => void refetch()} />}

        {data && data.items.length === 0 && (
          <EmptyState>
            There are no bloogs yet.{' '}
            <Link
              to="/register"
              className="font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              Create your own bloog
            </Link>
            .
          </EmptyState>
        )}

        {data && data.items.length > 0 && (
          <>
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {data.items.map((bloog) => (
                <li key={bloog.username} className="py-5">
                  <Link
                    to={`/bloogs/${bloog.username}`}
                    className="text-xl font-semibold hover:text-sky-700 dark:hover:text-sky-400"
                  >
                    {bloog.bloogTitle}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    by {bloog.username} · {bloog.postCount}{' '}
                    {bloog.postCount === 1 ? 'post' : 'posts'}
                    {bloog.latestPostAt !== null && (
                      <> · last posted {formatDate(bloog.latestPostAt)}</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Pagination
                page={data.page}
                hasPrevious={data.hasPrevious}
                hasNext={data.hasNext}
                hrefFor={(next) => (next === 1 ? '/bloogs' : `/bloogs?page=${next}`)}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
