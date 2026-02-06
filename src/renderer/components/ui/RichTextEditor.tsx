import React, { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Bold, Italic, Strikethrough, List, ListOrdered, Code, Link as LinkIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  compact?: boolean
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Write something...',
  className,
  minHeight = '80px',
  compact = false
}: RichTextEditorProps): React.ReactElement {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false
      }),
      Placeholder.configure({
        placeholder
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'text-primary underline cursor-pointer'
        }
      })
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      // Return empty string if only empty paragraph
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        ),
        style: `min-height: ${minHeight}`
      }
    }
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML() && content !== (editor.getHTML() === '<p></p>' ? '' : editor.getHTML())) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  if (!editor) return <div />

  return (
    <div className={cn('border rounded-md bg-background overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1 py-1 border-b bg-muted/30">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              const url = prompt('Enter URL:')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }
          }}
          active={editor.isActive('link')}
          title="Link"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  title,
  children
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-accent transition-colors',
        active && 'bg-accent text-primary'
      )}
    >
      {children}
    </button>
  )
}
