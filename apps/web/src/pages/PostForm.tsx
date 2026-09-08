import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { Button, Field, TextArea, TextInput } from '../components/ui'

export interface PostFormValues {
  title: string
  body: string
}

export function PostForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  initial: PostFormValues
  submitLabel: string
  pending: boolean
  error: unknown
  onSubmit: (values: PostFormValues) => void
}) {
  const [title, setTitle] = useState(initial.title)
  const [body, setBody] = useState(initial.body)

  const apiError = error instanceof ApiError ? error : null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit({ title, body })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Title" htmlFor="title" error={apiError?.fieldError('title')}>
        <TextInput
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          autoFocus
        />
      </Field>

      <Field
        label="Body"
        htmlFor="body"
        hint="Markdown is supported."
        error={apiError?.fieldError('body')}
      >
        <TextArea
          id="body"
          name="body"
          rows={16}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
      </Field>

      {/* Anything that is not a per-field problem, such as a 403 or a network failure. */}
      {apiError && apiError.fieldErrors.length === 0 && (
        <p role="alert" className="text-sm text-red">
          {apiError.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
