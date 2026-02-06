// Inbox is a special project that always exists
export const INBOX_PROJECT_ID = 'inbox'

// Default settings - must match AppSettings interface in src/renderer/hooks/useSettings.ts
export const DEFAULT_SETTINGS = {
  confirmDelete: true,
  weekStart: 0, // 0 = Sunday, 1 = Monday
  timeFormat: '12h' as '12h' | '24h',
  dateFormat: 'mdy' as 'mdy' | 'dmy' | 'ymd',
  notificationsEnabled: true,
  dailyGoal: 5,
  weeklyGoal: 25,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  defaultProject: INBOX_PROJECT_ID
} as const
