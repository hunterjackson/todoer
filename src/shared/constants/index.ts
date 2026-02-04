// Keyboard shortcuts
export const SHORTCUTS = {
  // Global
  QUICK_ADD: 'q',
  SEARCH: '/',
  GO_TO_TODAY: 'g t',
  GO_TO_UPCOMING: 'g u',
  GO_TO_INBOX: 'g i',

  // Task actions
  ADD_TASK: 'a',
  EDIT_TASK: 'e',
  DELETE_TASK: 'Delete',
  COMPLETE_TASK: 'c',
  SET_PRIORITY_1: '1',
  SET_PRIORITY_2: '2',
  SET_PRIORITY_3: '3',
  SET_PRIORITY_4: '4',
  SET_DUE_TODAY: 't',
  SET_DUE_TOMORROW: 'o',
  SET_DUE_NEXT_WEEK: 'w',
  REMOVE_DUE_DATE: 'r',
  MOVE_TO_PROJECT: 'm',
  ADD_LABEL: 'l',

  // Navigation
  MOVE_UP: 'ArrowUp',
  MOVE_DOWN: 'ArrowDown',
  EXPAND_COLLAPSE: 'ArrowRight',
  GO_TO_PARENT: 'ArrowLeft',
  OPEN_TASK: 'Enter',

  // Undo/Redo
  UNDO: 'Ctrl+z',
  REDO: 'Ctrl+Shift+z'
} as const

// Inbox is a special project that always exists
export const INBOX_PROJECT_ID = 'inbox'

// View modes
export const VIEW_MODES = {
  LIST: 'list',
  BOARD: 'board'
} as const

// Default settings
export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  startPage: 'today', // 'today' | 'inbox'
  weekStart: 0, // 0 = Sunday, 1 = Monday
  dateFormat: 'MMM d', // date-fns format
  timeFormat: 'h:mm a', // date-fns format
  showCompletedTasks: false,
  dailyGoal: 5,
  weeklyGoal: 25
} as const

// Date presets for quick selection
export const DATE_PRESETS = [
  { label: 'Today', value: 'today', shortcut: 't' },
  { label: 'Tomorrow', value: 'tomorrow', shortcut: 'o' },
  { label: 'Next week', value: 'next monday', shortcut: 'w' },
  { label: 'Next weekend', value: 'saturday', shortcut: 's' },
  { label: 'No date', value: null, shortcut: 'r' }
] as const

// IPC channel names
export const IPC_CHANNELS = {
  // Tasks
  TASKS_LIST: 'tasks:list',
  TASKS_GET: 'tasks:get',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_COMPLETE: 'tasks:complete',
  TASKS_UNCOMPLETE: 'tasks:uncomplete',
  TASKS_REORDER: 'tasks:reorder',
  TASKS_GET_TODAY: 'tasks:getToday',
  TASKS_GET_UPCOMING: 'tasks:getUpcoming',
  TASKS_GET_OVERDUE: 'tasks:getOverdue',
  TASKS_SEARCH: 'tasks:search',

  // Projects
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_REORDER: 'projects:reorder',

  // Labels
  LABELS_LIST: 'labels:list',
  LABELS_GET: 'labels:get',
  LABELS_CREATE: 'labels:create',
  LABELS_UPDATE: 'labels:update',
  LABELS_DELETE: 'labels:delete',

  // Sections
  SECTIONS_LIST: 'sections:list',
  SECTIONS_CREATE: 'sections:create',
  SECTIONS_UPDATE: 'sections:update',
  SECTIONS_DELETE: 'sections:delete',
  SECTIONS_REORDER: 'sections:reorder',

  // Filters
  FILTERS_LIST: 'filters:list',
  FILTERS_CREATE: 'filters:create',
  FILTERS_UPDATE: 'filters:update',
  FILTERS_DELETE: 'filters:delete',
  FILTERS_EVALUATE: 'filters:evaluate',

  // Date parsing
  DATE_PARSE: 'date:parse',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Events (main -> renderer)
  TASK_CHANGED: 'task:changed',
  PROJECT_CHANGED: 'project:changed',
  REMINDER_FIRED: 'reminder:fired'
} as const
