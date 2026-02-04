import React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useStore } from '@renderer/stores/useStore'
import { cn } from '@renderer/lib/utils'

export function ThemeToggle(): React.ReactElement {
  const { theme, setTheme } = useStore()

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' }
  ]

  return (
    <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'p-1.5 rounded transition-colors',
            theme === value
              ? 'bg-background shadow-sm'
              : 'hover:bg-background/50'
          )}
          title={label}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}
