import { useNavigate, useParams } from 'react-router'
import { usePost, useUpdatePost } from '../api/queries'
import { ErrorState, Spinner } from '../components/ui'
import { PostForm } from './PostForm'

export function EditPostPage() {
  const { id: rawId = '' } = useParams()
  const id = Number(rawId)

  const { data: post, error, isPending } = usePost(id)
  const update = useUpdatePost(id)
  const navigate = useNavigate()

  if (isPending) return <Spinner />
  if (error) return <ErrorState error={error} />
  if (!post) return null

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Edit Post</h1>

      <div className="mt-8">
        <PostForm
          // The raw Markdown, not the rendered HTML -- this is why PostDetail
          // carries `body` alongside `bodyHtml`.
          initial={{ title: post.title, body: post.body }}
          submitLabel="Save changes"
          pending={update.isPending}
          error={update.error}
          onSubmit={(values) => {
            update.mutate(values, {
              onSuccess: () => void navigate(`/bloogs/${post.author.username}/posts/${post.id}`),
            })
          }}
        />
      </div>
    </>
  )
}
