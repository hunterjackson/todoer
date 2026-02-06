import React, { useState } from 'react'
import { MessageSquare, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { useComments } from '../../hooks/useComments'
import { useSettings } from '@renderer/hooks/useSettings'
import { RichTextEditor } from '@renderer/components/ui/RichTextEditor'
import type { Comment } from '@shared/types'
import { sanitizeHtml, formatDateByPreference } from '@shared/utils'

function formatTime(date: Date, timeFormat: '12h' | '24h'): string {
  const hours = date.getHours()
  const mins = String(date.getMinutes()).padStart(2, '0')
  if (timeFormat === '24h') {
    return `${String(hours).padStart(2, '0')}:${mins}`
  }
  const h12 = hours % 12 || 12
  const ampm = hours < 12 ? 'AM' : 'PM'
  return `${h12}:${mins} ${ampm}`
}

interface TaskCommentsProps {
  taskId: string
}

export function TaskComments({ taskId }: TaskCommentsProps): React.ReactElement {
  const { comments, loading, error, addComment, updateComment, deleteComment } = useComments(taskId)
  const { settings } = useSettings()
  const [newComment, setNewComment] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      setSubmitError(null)
      const result = await addComment(newComment)
      if (result) {
        setNewComment('')
      } else {
        setSubmitError('Failed to add comment. Please try again.')
      }
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

    const timeStr = formatTime(date, settings.timeFormat)
    return `${formatDateByPreference(date, settings.dateFormat)} ${timeStr}`
  }

  // Check if content contains HTML tags
  const isHtml = (str: string) => /<[a-z][\s\S]*>/i.test(str)

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
              className="group p-3 rounded-lg bg-muted/50 border border-border"
            >
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <RichTextEditor
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Edit comment..."
                    minHeight="40px"
                    compact
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        saveEdit(comment.id)
                      }}
                      className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        cancelEditing()
                      }}
                      className="p-1.5 rounded hover:bg-accent"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {isHtml(comment.content) ? (
                    <div
                      className="text-sm rich-text-content"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.content) }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.createdAt)}
                      {comment.updatedAt > comment.createdAt && ' (edited)'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(comment)
                        }}
                        className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit comment"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(comment.id)
                        }}
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

      {/* Error display */}
      {(error || submitError) && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
          {submitError || error}
        </div>
      )}

      {/* Add comment - use div instead of form to avoid nested form issues */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              handleSubmit(e as unknown as React.FormEvent)
            }
          }}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
          disabled={!newComment.trim()}
          className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
