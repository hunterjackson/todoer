import React, { useEffect } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface ExportImportToastProps {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}

export function ExportImportToast({
  message,
  type,
  onClose
}: ExportImportToastProps): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
          type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
        <span
          className={`text-sm ${
            type === 'success'
              ? 'text-green-800 dark:text-green-200'
              : 'text-red-800 dark:text-red-200'
          }`}
        >
          {message}
        </span>
        <button
          onClick={onClose}
          className={`p-1 rounded hover:bg-opacity-20 ${
            type === 'success' ? 'hover:bg-green-600' : 'hover:bg-red-600'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
