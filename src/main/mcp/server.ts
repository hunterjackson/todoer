import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { initDatabase, getDatabase } from '../db'
import { TaskRepository } from '../db/repositories/taskRepository'
import { ProjectRepository } from '../db/repositories/projectRepository'
import { LabelRepository } from '../db/repositories/labelRepository'
import { parseDateWithRecurrence } from '../services/dateParser'
import { registerTools, handleToolCall } from './tools'
import { registerResources, handleResourceRead } from './resources'

export async function startMcpServer(): Promise<void> {
  // Initialize database
  initDatabase()

  const server = new Server(
    {
      name: 'todoer',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {
          subscribe: true
        }
      }
    }
  )

  // Register tool handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: registerTools() }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const db = getDatabase()
    const taskRepo = new TaskRepository(db)
    const projectRepo = new ProjectRepository(db)
    const labelRepo = new LabelRepository(db)

    return handleToolCall(request.params.name, request.params.arguments || {}, {
      taskRepo,
      projectRepo,
      labelRepo
    })
  })

  // Register resource handlers
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: registerResources() }
  })

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const db = getDatabase()
    const taskRepo = new TaskRepository(db)
    const projectRepo = new ProjectRepository(db)

    return handleResourceRead(request.params.uri, { taskRepo, projectRepo })
  })

  // Start the server
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Todoer MCP server started')
}
