import type {
  AdminUser,
  BloogSummary,
  BloogWithPosts,
  CreatePostInput,
  LoginInput,
  Page,
  PostDetail,
  PostSummary,
  PublicUser,
  RegisterInput,
  SessionResponse,
  UpdateAccountInput,
  UpdatePostInput,
} from '@blooger/shared/contracts'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, pageQuery, rememberCsrfToken } from './client'

export const queryKeys = {
  session: ['session'] as const,
  posts: (page: number) => ['posts', page] as const,
  post: (id: number) => ['post', id] as const,
  bloogs: (page: number) => ['bloogs', page] as const,
  bloog: (username: string, page: number) => ['bloog', username, page] as const,
  adminUsers: (page: number) => ['admin', 'users', page] as const,
  adminPosts: (page: number) => ['admin', 'posts', page] as const,
}

/** Anything a write could have changed. Cheaper to over-invalidate than to miss one. */
function invalidateContent(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: ['posts'] })
  void client.invalidateQueries({ queryKey: ['post'] })
  void client.invalidateQueries({ queryKey: ['bloogs'] })
  void client.invalidateQueries({ queryKey: ['bloog'] })
  void client.invalidateQueries({ queryKey: ['admin'] })
}

/**
 * The SPA's bootstrap call. Every mutation needs the CSRF token this returns, so
 * it is stored on the client as a side effect of reading the session.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      const session = await api.get<SessionResponse>('/api/me')
      rememberCsrfToken(session.csrfToken)
      return session
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useCurrentUser(): PublicUser | null {
  return useSession().data?.user ?? null
}

export function usePosts(page: number) {
  return useQuery({
    queryKey: queryKeys.posts(page),
    queryFn: () => api.get<Page<PostSummary>>(`/api/posts${pageQuery(page)}`),
  })
}

export function usePost(id: number) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => api.get<PostDetail>(`/api/posts/${id}`),
    enabled: Number.isFinite(id),
  })
}

export function useBloogs(page: number) {
  return useQuery({
    queryKey: queryKeys.bloogs(page),
    queryFn: () => api.get<Page<BloogSummary>>(`/api/bloogs${pageQuery(page)}`),
  })
}

export function useBloog(username: string, page: number) {
  return useQuery({
    queryKey: queryKeys.bloog(username, page),
    queryFn: () => api.get<BloogWithPosts>(`/api/bloogs/${encodeURIComponent(username)}${pageQuery(page)}`),
    enabled: username.length > 0,
  })
}

export function useAdminUsers(page: number) {
  return useQuery({
    queryKey: queryKeys.adminUsers(page),
    queryFn: () => api.get<Page<AdminUser>>(`/api/admin/users${pageQuery(page)}`),
  })
}

export function useAdminPosts(page: number) {
  return useQuery({
    queryKey: queryKeys.adminPosts(page),
    queryFn: () => api.get<Page<PostSummary>>(`/api/admin/posts${pageQuery(page)}`),
  })
}

/** Login and registration both return a fresh session, so they share this handling. */
function useSessionMutation<TInput>(send: (input: TInput) => Promise<SessionResponse>) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: send,
    onSuccess: (session) => {
      // The server regenerates the session on login, so the old token is dead.
      rememberCsrfToken(session.csrfToken)
      client.setQueryData(queryKeys.session, session)
      invalidateContent(client)
    },
  })
}

export function useLogin() {
  return useSessionMutation((input: LoginInput) => api.post<SessionResponse>('/api/sessions', input))
}

export function useRegister() {
  return useSessionMutation((input: RegisterInput) => api.post<SessionResponse>('/api/users', input))
}

export function useLogout() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => api.delete<void>('/api/sessions'),
    onSuccess: async () => {
      // Refetch rather than clear: the next session brings a new CSRF token, and
      // without it the very next mutation would be rejected.
      await client.invalidateQueries({ queryKey: queryKeys.session })
      invalidateContent(client)
    },
  })
}

export function useUpdateAccount() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateAccountInput) => api.patch<PublicUser>('/api/account', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.session })
      invalidateContent(client)
    },
  })
}

export function useCreatePost() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePostInput) => api.post<PostDetail>('/api/posts', input),
    onSuccess: () => invalidateContent(client),
  })
}

export function useUpdatePost(id: number) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdatePostInput) => api.patch<PostDetail>(`/api/posts/${id}`, input),
    onSuccess: () => invalidateContent(client),
  })
}

export function useDeletePost() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/posts/${id}`),
    onSuccess: () => invalidateContent(client),
  })
}

export function useDeleteUser() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/api/admin/users/${id}`),
    onSuccess: () => invalidateContent(client),
  })
}
