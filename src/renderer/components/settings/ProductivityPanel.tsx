import React, { useState, useEffect } from 'react'
import { X, Trophy, Flame, Target, TrendingUp, Calendar } from 'lucide-react'
import type { KarmaStats, KarmaHistory } from '@shared/types'

interface ProductivityPanelProps {
  open: boolean
  onClose: () => void
}

interface ProductivitySummary {
  karma: KarmaStats
  today: {
    tasksCompleted: number
    dailyGoal: number
    progress: number
    goalMet: boolean
  }
  week: {
    tasksCompleted: number
    weeklyGoal: number
    progress: number
    goalMet: boolean
    daysActive: number
  }
}

export function ProductivityPanel({ open, onClose }: ProductivityPanelProps): React.ReactElement | null {
  const [summary, setSummary] = useState<ProductivitySummary | null>(null)
  const [history, setHistory] = useState<KarmaHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setLoading(true)
    try {
      const summaryData = await window.api.karma.getProductivitySummary()
      setSummary(summaryData)

      // Get history for the last 7 days
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)

      const historyData = await window.api.karma.getHistory(
        weekAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      )
      setHistory(historyData)
    } catch (err) {
      // Silently handle - error state would show "No productivity data available"
    } finally {
      setLoading(false)
    }
  }

  // Handle escape key
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleEscape)
      return () => window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Productivity</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Karma Points */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-primary" />
                <div>
                  <div className="text-3xl font-bold">{summary.karma.totalPoints}</div>
                  <div className="text-sm text-muted-foreground">Karma Points</div>
                </div>
              </div>
            </div>

            {/* Streaks */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Current Streak</span>
                </div>
                <div className="text-2xl font-bold">
                  {summary.karma.currentStreak}
                  <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                </div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">Best Streak</span>
                </div>
                <div className="text-2xl font-bold">
                  {summary.karma.longestStreak}
                  <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                </div>
              </div>
            </div>

            {/* Daily Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Today&apos;s Progress</span>
                <span className="text-sm text-muted-foreground">
                  {summary.today.tasksCompleted} / {summary.today.dailyGoal} tasks
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    summary.today.goalMet ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{ width: `${summary.today.progress}%` }}
                />
              </div>
              {summary.today.goalMet && (
                <div className="text-xs text-green-500 mt-1">Daily goal achieved!</div>
              )}
            </div>

            {/* Weekly Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">This Week</span>
                <span className="text-sm text-muted-foreground">
                  {summary.week.tasksCompleted} / {summary.week.weeklyGoal} tasks
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    summary.week.goalMet ? 'bg-green-500' : 'bg-primary'
                  }`}
                  style={{ width: `${summary.week.progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary.week.daysActive} day{summary.week.daysActive !== 1 ? 's' : ''} active this week
              </div>
            </div>

            {/* Recent Activity */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Recent Activity</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() - (6 - i))
                    const dateStr = date.toISOString().split('T')[0]
                    const dayHistory = history.find((h) => h.date === dateStr)
                    const count = dayHistory?.tasksCompleted ?? 0
                    const intensity = count === 0 ? 0 : Math.min(4, Math.ceil(count / 2))

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full aspect-square rounded ${
                            intensity === 0
                              ? 'bg-muted/50'
                              : intensity === 1
                                ? 'bg-primary/25'
                                : intensity === 2
                                  ? 'bg-primary/50'
                                  : intensity === 3
                                    ? 'bg-primary/75'
                                    : 'bg-primary'
                          }`}
                          title={`${count} tasks on ${dateStr}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No productivity data available
          </div>
        )}
      </div>
    </div>
  )
}
