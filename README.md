# Todoer

A full-featured task management desktop application built with Electron, inspired by Todoist. Features local-first data storage with SQLite and an embedded MCP server for AI assistant integration.

## Features

- Task management with priorities (P1-P4), due dates, and descriptions
- Project organization with colors and custom views (list/board)
- Labels for cross-project tagging
- Custom filters with query syntax
- Multiple views: Today, Upcoming, Calendar, Search
- Subtasks and task hierarchy
- Natural language date parsing ("tomorrow", "next monday", etc.)
- Recurring tasks with RRULE support
- Dark mode / theme support
- Keyboard shortcuts
- MCP server integration for AI assistants

## Prerequisites

- Node.js 18 or higher
- npm 8 or higher

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd todoer

# Install dependencies
npm install
```

## Development

```bash
# Start the app in development mode with hot reload
npm run dev
```

The app will launch with Vite hot module replacement enabled for both the main and renderer processes.

## Building

```bash
# Build for production (current platform)
npm run build

# Build for specific platforms
npm run build:linux
npm run build:mac
npm run build:win
```

Built applications will be output to the `dist` directory.

## Testing

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run E2E tests with Playwright
npm run test:e2e
```

### Test Coverage

Current test coverage target: 80%+

The test suite includes:
- Unit tests for utilities, services, and repositories
- Integration tests for database operations
- E2E tests for user workflows using Playwright

## Data Storage

### Database Location

Todoer stores data in a SQLite database. The location depends on your operating system:

| OS | Default Location |
|----|------------------|
| Linux | `~/.config/todoer/todoer.db` |
| macOS | `~/Library/Application Support/todoer/todoer.db` |
| Windows | `%APPDATA%/todoer/todoer.db` |

### Changing Storage Location

To change where data is stored:

1. Close the Todoer application
2. Set the `TODOER_DATA_PATH` environment variable to your preferred directory
3. Optionally, move your existing `todoer.db` file to the new location
4. Restart the application

Example (Linux/macOS):
```bash
export TODOER_DATA_PATH=/path/to/your/data
./todoer
```

### Backup

To backup your data, simply copy the `todoer.db` file from the location shown above. The database is a standard SQLite file and can be opened with any SQLite-compatible tool.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Q` | Quick add task |
| `/` | Open search |
| `G` then `T` | Go to Today view |
| `G` then `I` | Go to Inbox |
| `G` then `U` | Go to Upcoming |
| `G` then `C` | Go to Calendar |
| `Escape` | Close modals/dialogs |

## Filter Query Syntax

Create custom filters using these operators:

| Query | Description |
|-------|-------------|
| `today` | Tasks due today |
| `tomorrow` | Tasks due tomorrow |
| `overdue` | Overdue tasks |
| `7 days` | Due within 7 days |
| `no date` | Tasks without due date |
| `p1`, `p2`, `p3`, `p4` | Filter by priority |
| `#project` | Filter by project name |
| `&` | AND (combine conditions) |
| `|` | OR (either condition) |

Example: `today & p1 | overdue` - High priority tasks due today OR any overdue tasks

## MCP Server Integration

Todoer includes an embedded MCP (Model Context Protocol) server for AI assistant integration.

### Available MCP Tools

- `todoer_list_tasks` - List tasks with filters
- `todoer_create_task` - Create a new task (supports NLP dates)
- `todoer_complete_task` - Mark task as complete
- `todoer_update_task` - Update task properties
- `todoer_delete_task` - Delete a task
- `todoer_list_projects` - List all projects
- `todoer_search` - Full-text search

### Connecting to Claude Code

```bash
# Add Todoer as an MCP server
claude mcp add todoer -- /path/to/todoer --mcp
```

## Project Structure

```
todoer/
├── src/
│   ├── main/           # Electron main process
│   │   ├── db/         # SQLite database & repositories
│   │   ├── mcp/        # MCP server implementation
│   │   ├── services/   # Business logic (date parsing, filters)
│   │   └── ipc/        # IPC handlers
│   ├── renderer/       # React UI
│   │   ├── components/ # UI components
│   │   ├── hooks/      # React hooks
│   │   └── stores/     # Zustand state management
│   ├── shared/         # Shared types & utilities
│   └── preload/        # Electron preload scripts
├── tests/
│   ├── unit/           # Unit tests
│   ├── integration/    # Database integration tests
│   └── e2e/            # Playwright E2E tests
└── resources/          # App icons and assets
```

## License

MIT
