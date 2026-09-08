import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth } from './guards'
import { mockFetch, renderWithProviders, SESSION_ANON, SESSION_JOE, USER_JOE } from '../test/render'

function renderGuarded({
  admin = false,
  route = '/private',
}: { admin?: boolean; route?: string } = {}) {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route element={<RequireAuth admin={admin} />}>
        <Route path="/private" element={<p>secret</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('RequireAuth', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends a visitor to the login page', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_ANON } })

    renderGuarded()

    expect(await screen.findByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('lets a logged-in user through', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_JOE } })

    renderGuarded()

    expect(await screen.findByText('secret')).toBeInTheDocument()
  })

  it('refuses a non-admin on an admin route without bouncing them to login', async () => {
    mockFetch({ 'GET /api/me': { body: SESSION_JOE } })

    renderGuarded({ admin: true })

    expect(await screen.findByRole('alert')).toHaveTextContent(/only for administrators/i)
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })

  it('lets an admin through', async () => {
    mockFetch({ 'GET /api/me': { body: { user: { ...USER_JOE, isAdmin: true }, csrfToken: 't' } } })

    renderGuarded({ admin: true })

    expect(await screen.findByText('secret')).toBeInTheDocument()
  })
})
