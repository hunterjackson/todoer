// Lightweight label info for task display (minimal fields for rendering)
export interface TaskLabel {
  id: string
  name: string
  color: string
}

// Task types
export interface Task {
  id: string
  content: string
  description: string | null
  projectId: string | null
  sectionId: string | null
  parentId: string | null
  dueDate: number | null
  deadline: number | null
  duration: number | null
  recurrenceRule: string | null
  priority: Priority
  completed: boolean
  completedAt: number | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  delegatedTo: string | null
  deletedAt: number | null
  // Virtual fields (populated from joins)
  labels?: TaskLabel[]
  subtasks?: Task[]
  project?: Project
}

export interface TaskCreate {
  content: string
  description?: string | null
  projectId?: string | null
  sectionId?: string | null
  parentId?: string | null
  dueDate?: number | string | null // Can be timestamp or natural language
  deadline?: number | null
  duration?: number | null
  recurrenceRule?: string | null
  priority?: Priority
  labelIds?: string[]
  delegatedTo?: string | null
}

export interface TaskUpdate {
  content?: string
  description?: string | null
  projectId?: string | null
  sectionId?: string | null
  parentId?: string | null
  dueDate?: number | string | null
  deadline?: number | null
  duration?: number | null
  recurrenceRule?: string | null
  priority?: Priority
  labelIds?: string[]
  sortOrder?: number
  delegatedTo?: string | null
}

// Priority levels (1 = highest, 4 = lowest/default)
export type Priority = 1 | 2 | 3 | 4

export const PRIORITY_COLORS: Record<Priority, string> = {
  1: '#d1453b', // Red
  2: '#eb8909', // Orange
  3: '#246fe0', // Blue
  4: '#808080'  // Gray
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: 'Priority 1',
  2: 'Priority 2',
  3: 'Priority 3',
  4: 'Priority 4'
}

// Project types
export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  parentId: string | null
  sortOrder: number
  viewMode: 'list' | 'board'
  isFavorite: boolean
  archivedAt: number | null
  createdAt: number
  deletedAt: number | null
  // Virtual fields
  subprojects?: Project[]
  sections?: Section[]
  taskCount?: number
}

export interface ProjectCreate {
  name: string
  description?: string | null
  color?: string
  parentId?: string | null
  viewMode?: 'list' | 'board'
  isFavorite?: boolean
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  color?: string
  parentId?: string | null
  viewMode?: 'list' | 'board'
  isFavorite?: boolean
  archivedAt?: number | null
}

// Section types
export interface Section {
  id: string
  name: string
  projectId: string
  sortOrder: number
  isCollapsed: boolean
  createdAt: number
  // Virtual fields
  tasks?: Task[]
}

export interface SectionCreate {
  name: string
  projectId: string
}

export interface SectionUpdate {
  name?: string
  isCollapsed?: boolean
}

// Label types
export interface Label {
  id: string
  name: string
  color: string
  sortOrder: number
  isFavorite: boolean
  createdAt: number
}

export interface LabelCreate {
  name: string
  color?: string
  isFavorite?: boolean
}

export interface LabelUpdate {
  name?: string
  color?: string
  isFavorite?: boolean
}

// Filter types
export interface Filter {
  id: string
  name: string
  query: string
  color: string
  sortOrder: number
  isFavorite: boolean
  createdAt: number
}

export interface FilterCreate {
  name: string
  query: string
  color?: string
  isFavorite?: boolean
}

export interface FilterUpdate {
  name?: string
  query?: string
  color?: string
  isFavorite?: boolean
}

// Comment types
export interface Comment {
  id: string
  taskId: string | null
  projectId: string | null
  content: string
  createdAt: number
  updatedAt: number
  // Virtual fields
  attachments?: Attachment[]
}

export interface CommentCreate {
  taskId?: string
  projectId?: string
  content: string
}

export interface CommentUpdate {
  content: string
}

// Attachment types
export interface Attachment {
  id: string
  commentId: string
  name: string
  mimeType: string
  size: number
  path: string
}

// Reminder types
export interface Reminder {
  id: string
  taskId: string
  remindAt: number
  notified: boolean
}

// Activity log types
export interface ActivityLog {
  id: string
  entityType: 'task' | 'project' | 'section' | 'label' | 'filter'
  entityId: string
  action: 'create' | 'update' | 'delete' | 'complete' | 'uncomplete'
  changesJson: string
  createdAt: number
}

// Karma types
export interface KarmaStats {
  id: string
  totalPoints: number
  currentStreak: number
  longestStreak: number
  dailyGoal: number
  weeklyGoal: number
}

export interface KarmaHistory {
  id: string
  date: string // YYYY-MM-DD
  points: number
  tasksCompleted: number
}

// View types
export type ViewType = 'today' | 'upcoming' | 'inbox' | 'project' | 'label' | 'filter' | 'search' | 'calendar'

// Default project colors
export const PROJECT_COLORS = [
  '#b8255f', // Berry Red
  '#db4035', // Red
  '#ff9933', // Orange
  '#fad000', // Yellow
  '#afb83b', // Olive Green
  '#7ecc49', // Lime Green
  '#299438', // Green
  '#6accbc', // Mint Green
  '#158fad', // Teal
  '#14aaf5', // Sky Blue
  '#96c3eb', // Light Blue
  '#4073ff', // Blue
  '#884dff', // Grape
  '#af38eb', // Violet
  '#eb96eb', // Lavender
  '#e05194', // Magenta
  '#ff8d85', // Salmon
  '#808080', // Charcoal
  '#b8b8b8', // Grey
  '#ccac93'  // Taupe
]

// Default label colors (same as project colors)
export const LABEL_COLORS = PROJECT_COLORS
