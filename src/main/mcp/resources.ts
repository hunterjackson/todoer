import type { Resource } from '@modelcontextprotocol/sdk/types.js'
import type { TaskRepository } from '../db/repositories/taskRepository'
import type { ProjectRepository } from '../db/repositories/projectRepository'
import { Database as SqlJsDatabase } from 'sql.js'

interface Repositories {
  taskRepo: TaskRepository
  projectRepo: ProjectRepository
  db: SqlJsDatabase
}

const STATIC_RESOURCES: Resource[] = [
  {
    uri: 'todoer://today',
    name: 'Today\'s Tasks',
    description: 'Tasks due today and overdue tasks',
    mimeType: 'application/json'
  },
  {
    uri: 'todoer://inbox',
    name: 'Inbox',
    description: 'Tasks in the Inbox project',
    mimeType: 'application/json'
  },
  {
    uri: 'todoer://overdue',
    name: 'Overdue Tasks',
    description: 'All overdue tasks',
    mimeType: 'application/json'
  },
  {
    uri: 'todoer://upcoming',
    name: 'Upcoming Tasks',
    description: 'Tasks due in the next 7 days',
    mimeType: 'application/json'
  },
  {
    uri: 'todoer://stats',
    name: 'Productivity Stats',
    description: 'Karma points, streaks, and productivity statistics',
    mimeType: 'application/json'
  }
]

export function registerResources(repos?: { projectRepo: ProjectRepository }): Resource[] {
  const resources = [...STATIC_RESOURCES]

  // Dynamically add project resources
  if (repos) {
    const projects = repos.projectRepo.list()
    for (const project of projects) {
      resources.push({
        uri: `todoer://project/${project.id}`,
        name: `Project: ${project.name}`,
        description: `Tasks in the "${project.name}" project`,
        mimeType: 'application/json'
      })
    }
  }

  return resources
}

interface KarmaStats {
  total_points: number
  current_streak: number
  longest_streak: number
  daily_goal: number
  weekly_goal: number
}

function getKarmaStats(db: SqlJsDatabase): KarmaStats | null {
  const stmt = db.prepare('SELECT * FROM karma_stats WHERE id = ?')
  stmt.bind(['default'])
  if (stmt.step()) {
    const result = stmt.getAsObject() as unknown as KarmaStats
    stmt.free()
    return result
  }
  stmt.free()
  return null
}

export function handleResourceRead(
  uri: string,
  repos: Repositories
): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  const { taskRepo, projectRepo, db } = repos

  // Parse project-specific URIs like todoer://project/abc123
  const projectMatch = uri.match(/^todoer:\/\/project\/(.+)$/)
  if (projectMatch) {
    const projectId = projectMatch[1]
    const project = projectRepo.get(projectId)
    if (!project) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Project not found' })
          }
        ]
      }
    }

    const tasks = taskRepo.list({ projectId, completed: false })
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            project: {
              id: project.id,
              name: project.name,
              color: project.color
            },
            tasks: tasks.map((t) => ({
              id: t.id,
              content: t.content,
              priority: t.priority,
              dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
              completed: t.completed
            }))
          }, null, 2)
        }
      ]
    }
  }

  switch (uri) {
    case 'todoer://today': {
      const tasks = taskRepo.getToday()
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              date: new Date().toISOString().split('T')[0],
              tasks: tasks.map((t) => ({
                id: t.id,
                content: t.content,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                completed: t.completed,
                projectId: t.projectId
              }))
            }, null, 2)
          }
        ]
      }
    }

    case 'todoer://inbox': {
      const tasks = taskRepo.list({ projectId: 'inbox', completed: false })
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              tasks: tasks.map((t) => ({
                id: t.id,
                content: t.content,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                completed: t.completed
              }))
            }, null, 2)
          }
        ]
      }
    }

    case 'todoer://overdue': {
      const tasks = taskRepo.getOverdue()
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              tasks: tasks.map((t) => ({
                id: t.id,
                content: t.content,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                projectId: t.projectId
              }))
            }, null, 2)
          }
        ]
      }
    }

    case 'todoer://upcoming': {
      const tasks = taskRepo.getUpcoming(7)
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              days: 7,
              tasks: tasks.map((t) => ({
                id: t.id,
                content: t.content,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                completed: t.completed,
                projectId: t.projectId
              }))
            }, null, 2)
          }
        ]
      }
    }

    case 'todoer://stats': {
      const stats = getKarmaStats(db)
      const pendingTasks = taskRepo.list({ completed: false })
      const overdueTasks = taskRepo.getOverdue()
      const todayTasks = taskRepo.getToday()

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              karma: {
                totalPoints: stats?.total_points ?? 0,
                currentStreak: stats?.current_streak ?? 0,
                longestStreak: stats?.longest_streak ?? 0,
                dailyGoal: stats?.daily_goal ?? 5,
                weeklyGoal: stats?.weekly_goal ?? 25
              },
              tasks: {
                pending: pendingTasks.length,
                overdue: overdueTasks.length,
                dueToday: todayTasks.length
              }
            }, null, 2)
          }
        ]
      }
    }

    default:
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: `Unknown resource: ${uri}` })
          }
        ]
      }
  }
}
