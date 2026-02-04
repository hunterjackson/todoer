import React, { useState } from 'react'
import { MessageSquare, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { useComments } from '../../hooks/useComments'
import type { Comment } from '@shared/types'

interface TaskCommentsProps {
  taskId: string
}

export function TaskComments({ taskId }: TaskCommentsProps): React.ReactElement {
  const { comments, loading, addComment, updateComment, deleteComment } = useComments(taskId)
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      await addComment(newComment)
      setNewComment('')
    }
  }

  const startEditing = (comment: Comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent('')
  }

  const saveEdit = async (id: string) => {
    if (editContent.trim()) {
      await updateComment(id, editContent)
    }
    cancelEditing()
  }

  const handleDelete = async (id: string) => {
    await deleteComment(id)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Comments ({comments.length})</span>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-muted-foreground">No comments yet</div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 rounded-lg bg-muted/50 border border-border"
            >
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 text-sm bg-background border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 rounded hover:bg-accent"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.createdAt)}
                      {comment.updatedAt > comment.createdAt && ' (edited)'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(comment)}
                        className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit comment"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!newComment.trim()}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
