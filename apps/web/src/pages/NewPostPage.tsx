import { useNavigate } from 'react-router'
import { useCreatePost } from '../api/queries'
import { PostForm } from './PostForm'

export function NewPostPage() {
  const create = useCreatePost()
  const navigate = useNavigate()

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">New Post</h1>

      <div className="mt-8">
        <PostForm
          initial={{ title: '', body: '' }}
          submitLabel="Publish"
          pending={create.isPending}
          error={create.error}
          onSubmit={(values) => {
            create.mutate(values, {
              onSuccess: (post) => void navigate(`/bloogs/${post.author.username}/posts/${post.id}`),
            })
          }}
        />
      </div>
    </>
  )
}
