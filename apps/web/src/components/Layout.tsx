import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useCurrentUser, useLogout } from '../api/queries'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'text-accent' : 'text-ink-dim hover:text-ink'
}

function Header() {
  const user = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout.mutateAsync()
    void navigate('/')
  }

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight text-ink">
          Blooger
        </Link>

        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/bloogs" className={navClass}>
            Bloogs
          </NavLink>

          <span className="flex-1" />

          {user ? (
            <>
              <NavLink to="/posts/new" className={navClass}>
                Bloog about it
              </NavLink>
              <NavLink to={`/bloogs/${user.username}`} className={navClass}>
                My bloog
              </NavLink>
              <NavLink to="/account" className={navClass}>
                Account
              </NavLink>
              {user.isAdmin && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
              <button
                onClick={() => void handleLogout()}
                disabled={logout.isPending}
                className="text-ink-dim hover:text-ink disabled:opacity-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Log in
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Create your own bloog
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-5 py-6 text-sm text-ink-faint">
        <span>Blooger</span>
        <span className="flex-1" />
        <a href="/feed.atom" className="hover:underline">
          Atom
        </a>
        <a href="/feed.rss" className="hover:underline">
          RSS
        </a>
        <a href="/feed.json" className="hover:underline">
          JSON Feed
        </a>
      </div>
    </footer>
  )
}

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
