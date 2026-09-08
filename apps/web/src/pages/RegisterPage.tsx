import { PASSWORD_MIN_LENGTH, USERNAME_MIN_LENGTH } from '@blooger/shared/contracts'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useRegister } from '../api/queries'
import { Button, Field, TextInput } from '../components/ui'

export function RegisterPage() {
  const [username, setUsername] = useState('')
  const [bloogTitle, setBloogTitle] = useState('')
  const [password, setPassword] = useState('')

  const register = useRegister()
  const navigate = useNavigate()
  const error = register.error instanceof ApiError ? register.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    register.mutate(
      { username, bloogTitle, password },
      { onSuccess: (session) => void navigate(`/bloogs/${session.user?.username ?? ''}`) },
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold tracking-tight">Register</h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          label="Username"
          htmlFor="username"
          hint={`At least ${USERNAME_MIN_LENGTH} characters. Letters, digits, underscores and hyphens.`}
          error={error?.fieldError('username')}
        >
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

        <Field
          label="Bloog title"
          htmlFor="bloogTitle"
          hint="The name of your bloog, e.g. “Joe's Bloog”."
          error={error?.fieldError('bloogTitle')}
        >
          <TextInput
            id="bloogTitle"
            name="bloogTitle"
            value={bloogTitle}
            onChange={(event) => setBloogTitle(event.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={error?.fieldError('password')}
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        {/* A taken username comes back as a 409 with no field attached. */}
        {error && error.fieldErrors.length === 0 && (
          <p role="alert" className="text-sm text-red">
            {error.message}
          </p>
        )}

        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? 'Creating…' : 'Create my bloog'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-dim">
        Already have one?{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
        .
      </p>
    </div>
  )
}
