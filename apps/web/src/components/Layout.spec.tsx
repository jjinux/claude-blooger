import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'
import { mockFetch, renderWithProviders, SESSION_ANON, SESSION_JOE, USER_JOE } from '../test/render'

function renderLayout() {
  renderWithProviders(
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<p>content</p>} />
      </Route>
    </Routes>,
  )
}

describe('Layout', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('offers login and registration to a visitor', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_ANON } })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create your own bloog/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument()
  })

  it('offers authoring links to a logged-in user', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_JOE } })

    renderLayout()

    expect(await screen.findByRole('link', { name: /bloog about it/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My bloog' })).toHaveAttribute('href', '/bloogs/joe')
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('hides the admin link from an ordinary user', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_JOE } })

    renderLayout()

    await screen.findByRole('link', { name: 'My bloog' })
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows the admin link to an admin', async () => {
    mockFetch({ 'GET /api/me': { body: { user: { ...USER_JOE, isAdmin: true }, csrfToken: 't' } } })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('always links the feeds, so readers can find them', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_ANON } })

    renderLayout()

    expect(await screen.findByRole('link', { name: 'Atom' })).toHaveAttribute('href', '/feed.atom')
    expect(screen.getByRole('link', { name: 'RSS' })).toHaveAttribute('href', '/feed.rss')
  })
})
