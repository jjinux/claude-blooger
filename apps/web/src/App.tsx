import { useQuery } from '@tanstack/react-query'

interface Health {
  status: string
  database: string
}

async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health')
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`)
  }
  return (await response.json()) as Health
}

/**
 * Placeholder shell. It exists to prove the whole chain works end to end --
 * Vite dev server, the /api proxy, Nest, and a real MySQL round-trip -- before
 * any real pages are built on top of it.
 */
export function App() {
  const { data, error, isPending } = useQuery({ queryKey: ['health'], queryFn: fetchHealth })

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Blooger
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          A simple multi-user blogging engine.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-500 uppercase dark:text-slate-400">
          API health
        </h2>
        {isPending && <p className="mt-2 text-slate-500">Checking...</p>}
        {error && (
          <p className="mt-2 text-red-600 dark:text-red-400">
            Cannot reach the API: {error.message}
          </p>
        )}
        {data && (
          <p className="mt-2 text-emerald-700 dark:text-emerald-400">
            {data.status} &mdash; connected to <code className="font-mono">{data.database}</code>
          </p>
        )}
      </div>
    </main>
  )
}
