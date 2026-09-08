import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

function renderWithQueryClient(ui: ReactElement) {
  // Retries off: a failing query should surface its error immediately rather than
  // making the test wait out the default backoff.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports which database the API is connected to', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', database: 'blooger_dev' }),
      }),
    )

    renderWithQueryClient(<App />)

    expect(await screen.findByText('blooger_dev')).toBeInTheDocument()
  })

  it('surfaces an unreachable API rather than spinning forever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    renderWithQueryClient(<App />)

    expect(await screen.findByText(/Cannot reach the API/)).toBeInTheDocument()
  })
})
