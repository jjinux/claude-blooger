import { PASSWORD_MIN_LENGTH } from '@blooger/shared/contracts'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { useCurrentUser, useUpdateAccount } from '../api/queries'
import { Button, Field, TextInput } from '../components/ui'

export function AccountPage() {
  const user = useCurrentUser()
  const update = useUpdateAccount()

  const [bloogTitle, setBloogTitle] = useState(user?.bloogTitle ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saved, setSaved] = useState(false)

  const error = update.error instanceof ApiError ? update.error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)

    // Omit the password fields entirely unless a new one was typed: the schema
    // rejects a currentPassword with no newPassword alongside it.
    const changingPassword = newPassword.length > 0

    update.mutate(
      changingPassword ? { bloogTitle, currentPassword, newPassword } : { bloogTitle },
      {
        onSuccess: () => {
          setSaved(true)
          setCurrentPassword('')
          setNewPassword('')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-ink-faint">Logged in as {user?.username}.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Bloog title" htmlFor="bloogTitle" error={error?.fieldError('bloogTitle')}>
          <TextInput
            id="bloogTitle"
            name="bloogTitle"
            value={bloogTitle}
            onChange={(event) => setBloogTitle(event.target.value)}
            required
          />
        </Field>

        <fieldset className="space-y-5 border-t border-line pt-5">
          <legend className="text-sm font-medium text-ink-dim">Change password</legend>

          <Field
            label="Current password"
            htmlFor="currentPassword"
            error={error?.fieldError('currentPassword')}
          >
            <TextInput
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="newPassword"
            hint={`Leave blank to keep your current password. At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={error?.fieldError('newPassword')}
          >
            <TextInput
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
        </fieldset>

        {error && error.fieldErrors.length === 0 && (
          <p role="alert" className="text-sm text-red">
            {error.message}
          </p>
        )}

        {saved && (
          <p role="status" className="text-sm text-accent">
            Saved.
          </p>
        )}

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
