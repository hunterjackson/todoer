import React, { useState, useEffect, useCallback } from 'react'
import { MessageSquare, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { RichTextEditor } from '@renderer/components/ui/RichTextEditor'
import type { Comment } from '@shared/types'
import { sanitizeHtml, formatDateByPreference, formatTime } from '@shared/utils'
import { useSettings } from '@renderer/hooks/useSettings'

interface ProjectCommentsProps {
  projectId: string
}

export function ProjectComments({ projectId }: ProjectCommentsProps): React.ReactElement {
  const { settings } = useSettings()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      const data = await window.api.comments.listByProject(projectId)
      setComments(data)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setError(null)

    try {
      const comment = await window.api.comments.create({
        projectId,
        content: newComment.trim()
      })
      setComments((prev) => [...prev, comment])
      setNewComment('')
    } catch {
      setError('Failed to add comment')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
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
    if (!editContent.trim()) return
    try {
      const updated = await window.api.comments.update(id, { content: editContent })
      setComments((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch {
      // Silently fail
    }
    cancelEditing()
  }

  const handleDelete = async (id: string) => {
    try {
      await window.api.comments.delete(id)
      setComments((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // Silently fail
    }
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

    const timeStr = formatTime(date, settings.timeFormat)
    return `${formatDateByPreference(date, settings.dateFormat)} ${timeStr}`
  }

  const isHtml = (str: string) => /<[a-z][\s\S]*>/i.test(str)

  return (
    <div className="space-y-4 border-t pt-4 mt-6">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageSquare className="w-4 h-4" />
        <span>Project Notes ({comments.length})</span>
      </div>

      {/* Comments list */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-muted-foreground">No notes yet</div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 bg-muted/50 rounded-lg group"
            >
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <RichTextEditor
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Edit note..."
                    minHeight="60px"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(comment.id)}
                      className="p-1 rounded hover:bg-accent text-green-600"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1 rounded hover:bg-accent text-muted-foreground"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    {isHtml(comment.content) ? (
                      <div
                        className="text-sm prose prose-sm max-w-none dark:prose-invert flex-1"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.content) }}
                      />
                    ) : (
                      <p className="text-sm flex-1 whitespace-pre-wrap">{comment.content}</p>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <button
                        onClick={() => startEditing(comment)}
                        className="p-1 rounded hover:bg-accent"
                        title="Edit"
                      >
                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="p-1 rounded hover:bg-accent"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(comment.createdAt)}
                    {comment.updatedAt !== comment.createdAt && ' (edited)'}
                  </p>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="space-y-2" onKeyDown={handleKeyDown}>
        <RichTextEditor
          content={newComment}
          onChange={setNewComment}
          placeholder="Add a note..."
          minHeight="60px"
        />
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-2 py-1 rounded">
            {error}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={!newComment.trim()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          Add Note
        </button>
      </div>
    </div>
  )
}
