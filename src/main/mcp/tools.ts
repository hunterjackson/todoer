import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { TaskRepository } from '../db/repositories/taskRepository'
import type { ProjectRepository } from '../db/repositories/projectRepository'
import type { LabelRepository } from '../db/repositories/labelRepository'
import { parseDateWithRecurrence } from '../services/dateParser'
import type { Priority } from '@shared/types'
import { Database as SqlJsDatabase } from 'sql.js'

interface Repositories {
  taskRepo: TaskRepository
  projectRepo: ProjectRepository
  labelRepo: LabelRepository
}

export function registerTools(): Tool[] {
  return [
    {
      name: 'todoer_list_tasks',
      description: 'List tasks with optional filters. Can filter by project, label, completion status, or get special views like today/upcoming/overdue.',
      inputSchema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: ['all', 'today', 'upcoming', 'overdue', 'inbox'],
            description: 'Special view to get. "today" shows due today + overdue, "upcoming" shows next 7 days, "overdue" shows past due tasks, "inbox" shows tasks in the inbox project.'
          },
          projectId: {
            type: 'string',
            description: 'Filter by project ID'
          },
          labelId: {
            type: 'string',
            description: 'Filter by label ID'
          },
          completed: {
            type: 'boolean',
            description: 'Filter by completion status'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 50)'
          }
        }
      }
    },
    {
      name: 'todoer_create_task',
      description: 'Create a new task. Supports natural language dates like "tomorrow 3pm", "next Monday", "every day".',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The task content/title'
          },
          description: {
            type: 'string',
            description: 'Optional longer description'
          },
          dueDate: {
            type: 'string',
            description: 'Due date - supports natural language like "tomorrow", "next week", "March 15", "every Monday"'
          },
          priority: {
            type: 'number',
            enum: [1, 2, 3, 4],
            description: 'Priority level: 1 (highest) to 4 (lowest/default)'
          },
          projectId: {
            type: 'string',
            description: 'Project ID to add task to (defaults to Inbox)'
          },
          labels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Label names to apply to the task'
          }
        },
        required: ['content']
      }
    },
    {
      name: 'todoer_complete_task',
      description: 'Mark a task as complete',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to complete'
          }
        },
        required: ['taskId']
      }
    },
    {
      name: 'todoer_uncomplete_task',
      description: 'Mark a completed task as incomplete',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to uncomplete'
          }
        },
        required: ['taskId']
      }
    },
    {
      name: 'todoer_update_task',
      description: 'Update an existing task',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to update'
          },
          content: {
            type: 'string',
            description: 'New task content'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          dueDate: {
            type: 'string',
            description: 'New due date (natural language supported)'
          },
          priority: {
            type: 'number',
            enum: [1, 2, 3, 4],
            description: 'New priority level'
          },
          projectId: {
            type: 'string',
            description: 'Move to a different project'
          }
        },
        required: ['taskId']
      }
    },
    {
      name: 'todoer_delete_task',
      description: 'Delete a task (soft delete)',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to delete'
          }
        },
        required: ['taskId']
      }
    },
    {
      name: 'todoer_list_projects',
      description: 'List all projects',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'todoer_create_project',
      description: 'Create a new project',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Project name'
          },
          color: {
            type: 'string',
            description: 'Project color (hex code like #ff0000)'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'todoer_search',
      description: 'Search tasks by content',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'todoer_get_stats',
      description: 'Get productivity statistics including karma points, streaks, and completion stats',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
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

export function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  repos: Repositories
): { content: Array<{ type: string; text: string }> } {
  const { taskRepo, projectRepo, labelRepo } = repos

  try {
    switch (name) {
      case 'todoer_list_tasks': {
        let tasks
        const view = args.view as string | undefined
        const limit = (args.limit as number) || 50

        if (view === 'today') {
          tasks = taskRepo.getToday()
        } else if (view === 'upcoming') {
          tasks = taskRepo.getUpcoming(7)
        } else if (view === 'overdue') {
          tasks = taskRepo.getOverdue()
        } else if (view === 'inbox') {
          tasks = taskRepo.list({ projectId: 'inbox', completed: false })
        } else {
          tasks = taskRepo.list({
            projectId: args.projectId as string | undefined,
            labelId: args.labelId as string | undefined,
            completed: args.completed as boolean | undefined
          })
        }

        tasks = tasks.slice(0, limit)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                tasks.map((t) => ({
                  id: t.id,
                  content: t.content,
                  priority: t.priority,
                  dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                  completed: t.completed,
                  projectId: t.projectId
                })),
                null,
                2
              )
            }
          ]
        }
      }

      case 'todoer_create_task': {
        const content = args.content as string
        let dueDate: number | null = null
        let recurrenceRule: string | null = null

        if (args.dueDate) {
          const parsed = parseDateWithRecurrence(args.dueDate as string)
          dueDate = parsed.date?.timestamp ?? null
          recurrenceRule = parsed.recurrence
        }

        // Resolve label names to IDs
        const labelIds: string[] = []
        if (args.labels && Array.isArray(args.labels)) {
          for (const labelName of args.labels as string[]) {
            let label = labelRepo.getByName(labelName)
            if (!label) {
              label = labelRepo.create({ name: labelName })
            }
            labelIds.push(label.id)
          }
        }

        const task = taskRepo.create({
          content,
          description: args.description as string | undefined,
          dueDate,
          recurrenceRule,
          priority: (args.priority as Priority) || 4,
          projectId: args.projectId as string | undefined,
          labelIds
        })

        return {
          content: [
            {
              type: 'text',
              text: `Created task: "${task.content}" (ID: ${task.id})`
            }
          ]
        }
      }

      case 'todoer_complete_task': {
        const task = taskRepo.complete(args.taskId as string)
        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${args.taskId}` }]
          }
        }
        return {
          content: [{ type: 'text', text: `Completed task: "${task.content}"` }]
        }
      }

      case 'todoer_uncomplete_task': {
        const task = taskRepo.uncomplete(args.taskId as string)
        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${args.taskId}` }]
          }
        }
        return {
          content: [{ type: 'text', text: `Uncompleted task: "${task.content}"` }]
        }
      }

      case 'todoer_update_task': {
        const taskId = args.taskId as string
        const updates: Record<string, unknown> = {}

        if (args.content) updates.content = args.content
        if (args.description !== undefined) updates.description = args.description
        if (args.priority) updates.priority = args.priority
        if (args.projectId) updates.projectId = args.projectId

        if (args.dueDate) {
          const parsed = parseDateWithRecurrence(args.dueDate as string)
          updates.dueDate = parsed.date?.timestamp ?? null
          if (parsed.recurrence) {
            updates.recurrenceRule = parsed.recurrence
          }
        }

        const task = taskRepo.update(taskId, updates)
        if (!task) {
          return {
            content: [{ type: 'text', text: `Task not found: ${taskId}` }]
          }
        }
        return {
          content: [{ type: 'text', text: `Updated task: "${task.content}"` }]
        }
      }

      case 'todoer_delete_task': {
        const deleted = taskRepo.delete(args.taskId as string)
        if (!deleted) {
          return {
            content: [{ type: 'text', text: `Task not found: ${args.taskId}` }]
          }
        }
        return {
          content: [{ type: 'text', text: `Deleted task: ${args.taskId}` }]
        }
      }

      case 'todoer_list_projects': {
        const projects = projectRepo.list()
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                projects.map((p) => ({
                  id: p.id,
                  name: p.name,
                  color: p.color,
                  taskCount: projectRepo.getTaskCount(p.id)
                })),
                null,
                2
              )
            }
          ]
        }
      }

      case 'todoer_create_project': {
        const project = projectRepo.create({
          name: args.name as string,
          color: args.color as string | undefined
        })
        return {
          content: [
            {
              type: 'text',
              text: `Created project: "${project.name}" (ID: ${project.id})`
            }
          ]
        }
      }

      case 'todoer_search': {
        const tasks = taskRepo.search(args.query as string)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                tasks.map((t) => ({
                  id: t.id,
                  content: t.content,
                  completed: t.completed,
                  projectId: t.projectId
                })),
                null,
                2
              )
            }
          ]
        }
      }

      case 'todoer_get_stats': {
        // Access the database from the repository (it has a private db property)
        const db = (taskRepo as unknown as { db: SqlJsDatabase }).db
        const stats = getKarmaStats(db)

        // Count tasks
        const allTasks = taskRepo.list({ completed: false })
        const completedToday = taskRepo.list({ completed: true })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  karma: stats?.total_points ?? 0,
                  currentStreak: stats?.current_streak ?? 0,
                  longestStreak: stats?.longest_streak ?? 0,
                  pendingTasks: allTasks.length,
                  completedToday: completedToday.length,
                  dailyGoal: stats?.daily_goal ?? 5,
                  weeklyGoal: stats?.weekly_goal ?? 25
                },
                null,
                2
              )
            }
          ]
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }]
        }
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    }
  }
}
