import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface DatePickerProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Set due date',
  className
}: DatePickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(value || new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    )
  }

  const isSelected = (day: number): boolean => {
    if (!value) return false
    return (
      value.getFullYear() === year &&
      value.getMonth() === month &&
      value.getDate() === day
    )
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(year, month, day)
    onChange(newDate)
    setIsOpen(false)
  }

  const handleQuickOption = (date: Date) => {
    onChange(date)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const goToPreviousMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  // Generate calendar grid
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Quick date options
  const quickOptions = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: new Date(Date.now() + 86400000) },
    { label: 'Next week', date: new Date(Date.now() + 7 * 86400000) },
  ]

  const formatDisplayDate = (date: Date): string => {
    const today = new Date()
    const tomorrow = new Date(Date.now() + 86400000)

    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      return 'Today'
    }

    if (
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate()
    ) {
      return 'Tomorrow'
    }

    return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-2 py-1 text-sm rounded-md',
          'hover:bg-accent transition-colors',
          value ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        <Calendar className="w-4 h-4" />
        <span>{value ? formatDisplayDate(value) : placeholder}</span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 p-0.5 hover:bg-muted rounded"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 p-3 bg-popover border rounded-lg shadow-lg z-50 min-w-[280px]">
          {/* Quick options */}
          <div className="flex gap-2 mb-3">
            {quickOptions.map(({ label, date }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleQuickOption(date)}
                className="px-2 py-1 text-xs rounded-md bg-muted hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-accent rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 hover:bg-accent rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((day) => (
              <div
                key={day}
                className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <button
                key={index}
                type="button"
                disabled={day === null}
                onClick={() => day && handleDayClick(day)}
                className={cn(
                  'w-8 h-8 flex items-center justify-center text-sm rounded-md',
                  day === null && 'invisible',
                  day !== null && 'hover:bg-accent',
                  isToday(day!) && 'font-bold text-primary',
                  isSelected(day!) && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setIsOpen(false)
              }}
              className="w-full mt-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}
