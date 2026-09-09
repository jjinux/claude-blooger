import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { AccountPage } from './pages/AccountPage'
import { BloogPage } from './pages/BloogPage'
import { BloogsPage } from './pages/BloogsPage'
import { EditPostPage } from './pages/EditPostPage'
import { RequireAuth } from './pages/guards'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NewPostPage } from './pages/NewPostPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PostPage } from './pages/PostPage'
import { RegisterPage } from './pages/RegisterPage'

/**
 * The only page most visitors will never open, and the heaviest one that is not
 * on the critical path: two paginated tables and a delete flow. Splitting it
 * keeps that out of the bundle everyone downloads to read a blog post.
 *
 * `.then` unwraps the named export -- `lazy` insists on a default one.
 */
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
)

/** Split out from App so tests can mount the routes inside their own router. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="bloogs" element={<BloogsPage />} />
        <Route path="bloogs/:username" element={<BloogPage />} />
        <Route path="bloogs/:username/posts/:id" element={<PostPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<RequireAuth />}>
          <Route path="account" element={<AccountPage />} />
          <Route path="posts/new" element={<NewPostPage />} />
          <Route path="posts/:id/edit" element={<EditPostPage />} />
        </Route>

        <Route element={<RequireAuth admin />}>
          <Route
            path="admin"
            element={
              // Inside the guard, so a non-admin is turned away without ever
              // fetching the chunk.
              <Suspense fallback={<Spinner />}>
                <AdminPage />
              </Suspense>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
