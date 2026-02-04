import { useState, useEffect, useCallback } from 'react'
import type { Comment } from '@shared/types'

export function useComments(taskId: string | null) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!taskId) {
      setComments([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await window.api.comments.list(taskId)
      setComments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const addComment = useCallback(
    async (content: string) => {
      if (!taskId || !content.trim()) return null

      try {
        const comment = await window.api.comments.create({
          taskId,
          content: content.trim()
        })
        setComments((prev) => [...prev, comment])
        return comment
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add comment')
        return null
      }
    },
    [taskId]
  )

  const updateComment = useCallback(async (id: string, content: string) => {
    try {
      const updated = await window.api.comments.update(id, { content })
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update comment')
      return null
    }
  }, [])

  const deleteComment = useCallback(async (id: string) => {
    try {
      await window.api.comments.delete(id)
      setComments((prev) => prev.filter((c) => c.id !== id))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete comment')
      return false
    }
  }, [])

  return {
    comments,
    loading,
    error,
    addComment,
    updateComment,
    deleteComment,
    refetch: fetchComments
  }
}
