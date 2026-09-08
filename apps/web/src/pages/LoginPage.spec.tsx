import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { mockFetch, renderWithProviders, SESSION_ANON, SESSION_JOE } from '../test/render'

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the credentials and sends the CSRF token it bootstrapped', async () => {
    const calls = mockFetch({
      'GET /api/me': { body: SESSION_ANON },
      'POST /api/sessions': { body: SESSION_JOE },
    })

    renderWithProviders(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Username'), 'joe')
    await userEvent.type(screen.getByLabelText('Password'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      const login = calls.find((call) => call.method === 'POST')
      expect(login?.body).toEqual({ username: 'joe', password: 'secret123' })
      expect(login?.headers.get('x-csrf-token')).toBe('test-token')
    })
  })

  it('shows the server message when the credentials are wrong', async () => {
    mockFetch({
      'GET /api/me': { body: SESSION_ANON },
      'POST /api/sessions': { status: 401, body: { message: 'Incorrect username or password' } },
    })

    renderWithProviders(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Username'), 'joe')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password')
  })

  it('reports being rate limited rather than failing silently', async () => {
    mockFetch({
      'GET /api/me': { body: SESSION_ANON },
      'POST /api/sessions': {
        status: 429,
        body: { message: 'Too many attempts. Try again shortly.' },
      },
    })

    renderWithProviders(<LoginPage />)

    await userEvent.type(screen.getByLabelText('Username'), 'joe')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })
})
