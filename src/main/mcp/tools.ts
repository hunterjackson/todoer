import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { TaskRepository } from '../db/repositories/taskRepository'
import type { ProjectRepository } from '../db/repositories/projectRepository'
import type { LabelRepository } from '../db/repositories/labelRepository'
import type { KarmaEngine } from '../services/karmaEngine'
import { parseDateWithRecurrence } from '../services/dateParser'
import { calculateNextDueDate } from '../services/recurrenceEngine'
import type { Priority } from '@shared/types'
import { formatDateByPreference } from '@shared/utils'

interface Repositories {
  taskRepo: TaskRepository
  projectRepo: ProjectRepository
  labelRepo: LabelRepository
  karmaEngine: KarmaEngine
}

function normalizePriority(value: unknown): Priority {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) {
    return parsed
  }
  return 4
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

export function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  repos: Repositories
): { content: Array<{ type: string; text: string }> } {
  const { taskRepo, projectRepo, labelRepo, karmaEngine } = repos

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
          priority: normalizePriority(args.priority),
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
        const taskId = args.taskId as string
        const taskBeforeComplete = taskRepo.get(taskId)
        if (!taskBeforeComplete) {
          return {
            content: [{ type: 'text', text: `Task not found: ${taskId}` }]
          }
        }

        const task = taskRepo.complete(taskId)
        if (task) {
          karmaEngine.recordTaskCompletion(task)
        }

        // Handle recurring tasks - create next occurrence
        // Use existing dueDate or today as base when no dueDate is set
        if (taskBeforeComplete.recurrenceRule) {
          const completedAt = Date.now()
          const baseDueDate = taskBeforeComplete.dueDate ?? completedAt
          const nextDueDate = calculateNextDueDate(
            taskBeforeComplete.recurrenceRule,
            baseDueDate,
            completedAt
          )

          if (nextDueDate) {
            // Uncomplete the task and set the next due date
            taskRepo.uncomplete(taskId)
            taskRepo.update(taskId, { dueDate: nextDueDate })
            const nextDateStr = formatDateByPreference(new Date(nextDueDate), 'mdy')
            return {
              content: [{ type: 'text', text: `Completed recurring task: "${taskBeforeComplete.content}" - next due: ${nextDateStr}` }]
            }
          }
        }

        return {
          content: [{ type: 'text', text: `Completed task: "${taskBeforeComplete.content}"` }]
        }
      }

      case 'todoer_uncomplete_task': {
        const taskId = args.taskId as string
        const taskBefore = taskRepo.get(taskId)
        if (!taskBefore) {
          return {
            content: [{ type: 'text', text: `Task not found: ${taskId}` }]
          }
        }

        const task = taskRepo.uncomplete(taskId)
        if (taskBefore) {
          karmaEngine.recordTaskUncompletion(taskBefore)
        }

        return {
          content: [{ type: 'text', text: `Uncompleted task: "${task?.content}"` }]
        }
      }

      case 'todoer_update_task': {
        const taskId = args.taskId as string
        const updates: Record<string, unknown> = {}

        if (args.content) updates.content = args.content
        if (args.description !== undefined) updates.description = args.description
        if (args.priority !== undefined) updates.priority = normalizePriority(args.priority)
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
        // Get karma stats from engine
        const karmaStats = karmaEngine.getStats()
        const todayStats = karmaEngine.getTodayStats()
        const weekStats = karmaEngine.getWeekStats()

        // Count pending tasks
        const allTasks = taskRepo.list({ completed: false })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  karma: karmaStats.totalPoints,
                  currentStreak: karmaStats.currentStreak,
                  longestStreak: karmaStats.longestStreak,
                  pendingTasks: allTasks.length,
                  completedToday: todayStats.tasksCompleted,
                  dailyGoal: karmaStats.dailyGoal,
                  dailyProgress: todayStats.progress,
                  dailyGoalMet: todayStats.goalMet,
                  weeklyGoal: karmaStats.weeklyGoal,
                  weeklyProgress: weekStats.progress,
                  weeklyGoalMet: weekStats.goalMet
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
