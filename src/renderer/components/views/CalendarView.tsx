import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import { useTasks } from '@hooks/useTasks'
import { cn } from '@renderer/lib/utils'
import type { Task } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function CalendarView(): React.ReactElement {
  const { tasks, completeTask, uncompleteTask } = useTasks()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of month and total days
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    tasks.forEach((task) => {
      if (task.dueDate && !task.deletedAt) {
        const date = new Date(task.dueDate)
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key)!.push(task)
      }
    })
    return map
  }, [tasks])

  const getTasksForDay = (day: number): Task[] => {
    const key = `${year}-${month}-${day}`
    return tasksByDate.get(key) || []
  }

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const isToday = (day: number): boolean => {
    const today = new Date()
    return (
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day
    )
  }

  const isSelected = (day: number): boolean => {
    if (!selectedDate) return false
    return (
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day
    )
  }

  // Generate calendar grid
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDayWeekday; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  // Selected day tasks - use the selected date's year/month/day, not the current view month
  const selectedDayTasks = useMemo(() => {
    if (!selectedDate) return []
    const key = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`
    return tasksByDate.get(key) || []
  }, [selectedDate, tasksByDate])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-accent"
          >
            Today
          </button>
          <button
            onClick={goToPreviousMonth}
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-medium min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1.5 rounded-md hover:bg-accent"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Day headers */}
            {DAYS.map((day) => (
              <div
                key={day}
                className="bg-muted/50 py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const dayTasks = day ? getTasksForDay(day) : []
              const incompleteTasks = dayTasks.filter((t) => !t.completed)
              const hasOverdue = day && day < new Date().getDate() &&
                month <= new Date().getMonth() &&
                year <= new Date().getFullYear() &&
                incompleteTasks.length > 0

              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(new Date(year, month, day))}
                  className={cn(
                    'bg-background min-h-[80px] p-1 cursor-pointer hover:bg-accent/30 transition-colors',
                    day === null && 'bg-muted/20',
                    isSelected(day!) && 'ring-2 ring-primary ring-inset',
                    isToday(day!) && 'bg-primary/10'
                  )}
                >
                  {day !== null && (
                    <>
                      <div
                        className={cn(
                          'text-sm font-medium mb-1',
                          isToday(day) && 'text-primary font-bold',
                          hasOverdue && 'text-destructive'
                        )}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              'text-xs px-1 py-0.5 rounded truncate',
                              task.completed
                                ? 'bg-muted text-muted-foreground line-through'
                                : 'bg-primary/10'
                            )}
                            style={{
                              borderLeft: `2px solid ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}`
                            }}
                          >
                            {task.content}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayTasks.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Day Panel */}
        {selectedDate && (
          <div className="w-72 shrink-0">
            <div className="sticky top-6 bg-card border rounded-lg p-4">
              <h3 className="font-medium mb-3">
                {MONTHS[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
              </h3>
              {selectedDayTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-2 text-sm"
                    >
                      <button
                        onClick={() =>
                          task.completed
                            ? uncompleteTask(task.id)
                            : completeTask(task.id)
                        }
                        className="mt-0.5 flex-shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Circle
                            className="w-4 h-4"
                            style={{
                              color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]
                            }}
                          />
                        )}
                      </button>
                      <span
                        className={cn(
                          task.completed && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
