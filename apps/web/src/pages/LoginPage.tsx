import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useLogin } from '../api/queries'
import { Button, Field, TextInput } from '../components/ui'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()

  // Set by RequireAuth when it bounced someone away from a protected page.
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const error = login.error instanceof ApiError ? login.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    login.mutate({ username, password }, { onSuccess: () => void navigate(from, { replace: true }) })
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold tracking-tight">Log in</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Username" htmlFor="username" error={error?.fieldError('username')}>
          <TextInput
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            autoFocus
          />
        </Field>

        <Field label="Password" htmlFor="password" error={error?.fieldError('password')}>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        {/* The server deliberately gives one message for both a bad username and a
            bad password, so there is nothing more specific to show here. */}
        {error && error.fieldErrors.length === 0 && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error.message}
          </p>
        )}

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
        No account?{' '}
        <Link to="/register" className="font-medium text-sky-700 hover:underline dark:text-sky-400">
          Create your own bloog
        </Link>
        .
      </p>
    </div>
  )
}
