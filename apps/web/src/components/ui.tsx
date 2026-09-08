import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router'

/* Shared primitives. Small on purpose -- this is a blog, not a design system. */

// Square corners and a visible border throughout: the theme is a terminal, and
// terminals do not have rounded, shadowed surfaces.
const BUTTON_BASE =
  'inline-flex items-center justify-center border px-3 py-1.5 text-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  primary: 'border-accent bg-accent text-canvas hover:bg-accent-strong hover:border-accent-strong',
  secondary: 'border-line bg-surface text-ink hover:border-ink-faint',
  // Red is the one colour not sampled from the terminal -- the screenshot had
  // none -- and it carries every negative signal here: errors as well as
  // destruction.
  danger: 'border-red bg-transparent text-red hover:bg-red hover:text-canvas',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`} />
}

export function ButtonLink({
  to,
  variant = 'primary',
  children,
}: {
  to: string
  variant?: keyof typeof VARIANTS
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${BUTTON_BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  )
}

const CONTROL =
  'w-full border border-line bg-canvas px-3 py-2 text-ink ' +
  'placeholder:text-ink-ghost focus:border-accent focus:outline-none'

interface FieldProps {
  label: string
  htmlFor: string
  error?: string | undefined
  hint?: string | undefined
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm text-ink-dim">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-faint">{hint}</p>}
      {/* role="alert" so a screen reader announces the failure on submit. */}
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CONTROL} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} text-sm`} />
}

export function Spinner({ label = 'loading…' }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-ink-faint">
      <span className="text-ink-ghost">$ </span>
      {label}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-line py-12 text-center text-ink-faint">
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <div role="alert" className="border border-red bg-surface p-4 text-ink">
      <p>
        <span className="text-red">error: </span>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm text-accent underline underline-offset-2">
          retry
        </button>
      )}
    </div>
  )
}

/**
 * "Older entries" first, matching how a blog reads: the primary direction is
 * backwards in time.
 */
export function Pagination({
  page,
  hasPrevious,
  hasNext,
  hrefFor,
}: {
  page: number
  hasPrevious: boolean
  hasNext: boolean
  hrefFor: (page: number) => string
}) {
  if (!hasPrevious && !hasNext) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-line pt-6"
    >
      {hasNext ? (
        <Link to={hrefFor(page + 1)} className="text-sm text-accent hover:underline">
          &lt;-- older entries
        </Link>
      ) : (
        <span />
      )}
      {hasPrevious ? (
        <Link to={hrefFor(page - 1)} className="text-sm text-accent hover:underline">
          newer entries --&gt;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
