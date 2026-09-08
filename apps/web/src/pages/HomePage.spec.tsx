import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import { mockFetch, page, post, renderWithProviders } from '../test/render'

describe('HomePage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders posts with their server-rendered HTML', async () => {
    mockFetch({ 'GET /api/posts': { body: page([post({ title: 'First' })]) } })

    renderWithProviders(<HomePage />)

    expect(await screen.findByText('First')).toBeInTheDocument()
    // The <strong> comes from the server's bodyHtml, not from parsing Markdown here.
    expect(screen.getByText('hi').tagName).toBe('STRONG')
  })

  it('shows the empty state when nobody has posted', async () => {
    mockFetch({ 'GET /api/posts': { body: page([]) } })

    renderWithProviders(<HomePage />)

    expect(await screen.findByText('There are no bloog posts yet.')).toBeInTheDocument()
  })

  it('surfaces an API failure instead of spinning forever', async () => {
    mockFetch({ 'GET /api/posts': { status: 500, body: { message: 'Boom' } } })

    renderWithProviders(<HomePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
  })

  it('offers an older-entries link only when there is another page', async () => {
    mockFetch({ 'GET /api/posts': { body: page([post()], { hasNext: true, totalPages: 2 }) } })

    renderWithProviders(<HomePage />)

    const older = await screen.findByRole('link', { name: /older entries/i })
    expect(older).toHaveAttribute('href', '/?page=2')
    expect(screen.queryByRole('link', { name: /newer entries/i })).not.toBeInTheDocument()
  })

  it('requests the page named in the query string', async () => {
    const calls = mockFetch({ 'GET /api/posts?page=3': { body: page([]) } })

    renderWithProviders(<HomePage />, { route: '/?page=3' })

    await waitFor(() => expect(calls[0]?.url).toBe('/api/posts?page=3'))
  })
})
