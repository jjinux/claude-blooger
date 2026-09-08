import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

/* Shared primitives. Small on purpose -- this is a blog, not a design system. */

const BUTTON_BASE =
  'inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS = {
  primary: 'bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500',
  secondary:
    'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 ' +
    'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-600',
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
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

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
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {/* role="alert" so a screen reader announces the failure on submit. */}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
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
  return <textarea {...props} className={`${CONTROL} font-mono text-sm`} />
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">
      {label}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-medium underline underline-offset-2">
          Try again
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
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-200 pt-6 dark:border-slate-800">
      {hasNext ? (
        <Link to={hrefFor(page + 1)} className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">
          ← Older entries
        </Link>
      ) : (
        <span />
      )}
      {hasPrevious ? (
        <Link to={hrefFor(page - 1)} className="text-sm font-medium text-sky-700 hover:underline dark:text-sky-400">
          Newer entries →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
