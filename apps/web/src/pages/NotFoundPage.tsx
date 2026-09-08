import { ButtonLink } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-ink-dim">There is no bloog, post, or page at that address.</p>
      <div className="mt-6">
        <ButtonLink to="/">Back to the homepage</ButtonLink>
      </div>
    </div>
  )
}
