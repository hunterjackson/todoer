import React, { useState, useMemo } from 'react'
import {
  CalendarDays,
  Inbox,
  Calendar,
  CalendarRange,
  Search,
  Plus,
  Tag,
  Filter,
  Settings,
  BarChart3,
  ChevronRight
} from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { useProjects } from '@hooks/useProjects'
import { useLabels } from '@hooks/useLabels'
import { useFilters } from '@hooks/useFilters'
import { cn } from '@renderer/lib/utils'
import { ThemeToggle } from '@renderer/components/ui/ThemeToggle'
import { ProjectDialog } from '@renderer/components/project/ProjectDialog'
import { LabelDialog } from '@renderer/components/label/LabelDialog'
import { FilterDialog } from '@renderer/components/filter/FilterDialog'
import type { ViewType, Project, Label, Filter as FilterType, ProjectCreate, ProjectUpdate, LabelCreate, LabelUpdate, FilterCreate, FilterUpdate } from '@shared/types'
import { INBOX_PROJECT_ID } from '@shared/constants'

interface ProjectNode extends Project {
  children: ProjectNode[]
  depth: number
}

interface SidebarProps {
  currentView: ViewType
  currentViewId?: string
  onViewChange: (view: ViewType, id?: string) => void
  onQuickAdd: () => void
  onOpenSettings?: () => void
  onOpenProductivity?: () => void
}

// Build a tree structure from flat projects list
function buildProjectTree(projects: Project[]): ProjectNode[] {
  const nodeMap = new Map<string, ProjectNode>()
  const roots: ProjectNode[] = []

  // Create nodes
  for (const project of projects) {
    nodeMap.set(project.id, { ...project, children: [], depth: 0 })
  }

  // Build tree
  for (const project of projects) {
    const node = nodeMap.get(project.id)!
    if (project.parentId && nodeMap.has(project.parentId)) {
      const parent = nodeMap.get(project.parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sortOrder
  const sortNodes = (nodes: ProjectNode[]): void => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder)
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }
  sortNodes(roots)

  return roots
}

// Flatten tree for rendering
function flattenProjectTree(nodes: ProjectNode[]): ProjectNode[] {
  const result: ProjectNode[] = []
  const traverse = (node: ProjectNode): void => {
    result.push(node)
    for (const child of node.children) {
      traverse(child)
    }
  }
  for (const node of nodes) {
    traverse(node)
  }
  return result
}

export function Sidebar({ currentView, currentViewId, onViewChange, onQuickAdd, onOpenSettings, onOpenProductivity }: SidebarProps): React.ReactElement {
  const { projects, createProject, updateProject, deleteProject, duplicateProject } = useProjects()
  const { labels, createLabel, updateLabel, deleteLabel } = useLabels()
  const { filters, createFilter, updateFilter, deleteFilter } = useFilters()
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [showArchivedProjects, setShowArchivedProjects] = useState(false)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [editingLabel, setEditingLabel] = useState<Label | null>(null)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<FilterType | null>(null)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // Filter out inbox and optionally archived projects
  const userProjects = projects.filter((p) => p.id !== INBOX_PROJECT_ID && !p.archivedAt)
  const archivedProjects = projects.filter((p) => p.id !== INBOX_PROJECT_ID && p.archivedAt)

  // Build hierarchical project structure
  const projectTree = useMemo(() => buildProjectTree(userProjects), [userProjects])
  const flattenedProjects = useMemo(() => flattenProjectTree(projectTree), [projectTree])

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  // Check if a project should be visible (not hidden by collapsed parent)
  const isProjectVisible = (project: ProjectNode): boolean => {
    let current = project
    while (current.parentId) {
      if (collapsedProjects.has(current.parentId)) return false
      const parent = userProjects.find((p) => p.id === current.parentId)
      if (!parent) break
      current = { ...parent, children: [], depth: 0 }
    }
    return true
  }

  const handleCreateProject = async (data: ProjectCreate | ProjectUpdate) => {
    if (editingProject) {
      await updateProject(editingProject.id, data as ProjectUpdate)
    } else {
      await createProject(data as ProjectCreate)
    }
    setEditingProject(null)
  }

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id)
    setEditingProject(null)
  }

  const handleArchiveProject = async (id: string, archive: boolean) => {
    await updateProject(id, { archivedAt: archive ? Date.now() : null })
    setEditingProject(null)
  }

  const handleDuplicateProject = async (id: string) => {
    await duplicateProject(id)
    setEditingProject(null)
  }

  const handleSaveLabel = async (data: LabelCreate | LabelUpdate) => {
    if (editingLabel) {
      await updateLabel(editingLabel.id, data as LabelUpdate)
    } else {
      await createLabel(data as LabelCreate)
    }
    setEditingLabel(null)
  }

  const handleDeleteLabel = async (id: string) => {
    await deleteLabel(id)
    setEditingLabel(null)
    // If we're viewing this label, navigate away
    if (currentView === 'label' && currentViewId === id) {
      onViewChange('inbox')
    }
  }

  const handleSaveFilter = async (data: FilterCreate | FilterUpdate) => {
    if (editingFilter) {
      await updateFilter(editingFilter.id, data as FilterUpdate)
    } else {
      await createFilter(data as FilterCreate)
    }
    setEditingFilter(null)
  }

  const handleDeleteFilter = async (id: string) => {
    await deleteFilter(id)
    setEditingFilter(null)
    // If we're viewing this filter, navigate away
    if (currentView === 'filter' && currentViewId === id) {
      onViewChange('inbox')
    }
  }

  return (
    <aside className="w-64 h-full bg-muted/30 border-r flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Todoer</h1>
        <button
          onClick={onQuickAdd}
          className="p-1.5 rounded-md hover:bg-accent text-primary"
          title="Quick Add (Q)"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* Views */}
        <div className="space-y-0.5">
          <SidebarItem
            icon={<Inbox className="w-4 h-4" />}
            label="Inbox"
            active={currentView === 'inbox'}
            onClick={() => onViewChange('inbox')}
          />
          <SidebarItem
            icon={<CalendarDays className="w-4 h-4" />}
            label="Today"
            active={currentView === 'today'}
            onClick={() => onViewChange('today')}
            shortcut="G T"
          />
          <SidebarItem
            icon={<Calendar className="w-4 h-4" />}
            label="Upcoming"
            active={currentView === 'upcoming'}
            onClick={() => onViewChange('upcoming')}
            shortcut="G U"
          />
          <SidebarItem
            icon={<CalendarRange className="w-4 h-4" />}
            label="Calendar"
            active={currentView === 'calendar'}
            onClick={() => onViewChange('calendar')}
            shortcut="G C"
          />
          <SidebarItem
            icon={<Search className="w-4 h-4" />}
            label="Search"
            active={currentView === 'search'}
            onClick={() => onViewChange('search')}
            shortcut="/"
          />
        </div>

        {/* Filters */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Filters
            </span>
            <button
              onClick={() => setFilterDialogOpen(true)}
              className="p-0.5 rounded hover:bg-accent"
              title="Add filter"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-0.5 mt-1">
            {filters.map((filter) => (
              <SidebarItem
                key={filter.id}
                icon={<Filter className="w-4 h-4" style={{ color: filter.color }} />}
                label={filter.name}
                active={currentView === 'filter' && currentViewId === filter.id}
                onClick={() => onViewChange('filter', filter.id)}
                onDoubleClick={() => setEditingFilter(filter)}
              />
            ))}
            {filters.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No filters yet
              </p>
            )}
          </div>
        </div>

        {/* Projects */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => setProjectDialogOpen(true)}
              className="p-0.5 rounded hover:bg-accent"
              title="Add project"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-0.5 mt-1">
            {flattenedProjects.map((project) => {
              if (!isProjectVisible(project)) return null
              const hasChildren = project.children.length > 0
              const isCollapsed = collapsedProjects.has(project.id)

              return (
                <DroppableProjectItem
                  key={project.id}
                  projectId={project.id}
                  icon={
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                  }
                  label={project.name}
                  active={currentView === 'project' && currentViewId === project.id}
                  onClick={() => onViewChange('project', project.id)}
                  onDoubleClick={() => setEditingProject(project)}
                  depth={project.depth}
                  hasChildren={hasChildren}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={() => toggleProjectCollapse(project.id)}
                />
              )
            })}
            {userProjects.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No projects yet
              </p>
            )}
          </div>

          {/* Archived projects */}
          {archivedProjects.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowArchivedProjects(!showArchivedProjects)}
                className="flex items-center gap-1 px-3 py-1 text-xs text-muted-foreground hover:text-foreground w-full"
              >
                <ChevronRight className={cn('w-3 h-3 transition-transform', showArchivedProjects && 'rotate-90')} />
                Archived ({archivedProjects.length})
              </button>
              {showArchivedProjects && (
                <div className="space-y-0.5 mt-1">
                  {archivedProjects.map((project) => (
                    <DroppableProjectItem
                      key={project.id}
                      projectId={project.id}
                      icon={
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 opacity-50"
                          style={{ backgroundColor: project.color }}
                        />
                      }
                      label={project.name}
                      active={currentView === 'project' && currentViewId === project.id}
                      onClick={() => onViewChange('project', project.id)}
                      onDoubleClick={() => setEditingProject(project)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Labels */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Labels
            </span>
            <button
              onClick={() => setLabelDialogOpen(true)}
              className="p-0.5 rounded hover:bg-accent"
              title="Add label"
            >
              <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-0.5 mt-1">
            {labels.map((label) => (
              <SidebarItem
                key={label.id}
                icon={<Tag className="w-4 h-4" style={{ color: label.color }} />}
                label={label.name}
                active={currentView === 'label' && currentViewId === label.id}
                onClick={() => onViewChange('label', label.id)}
                onDoubleClick={() => setEditingLabel(label)}
              />
            ))}
            {labels.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No labels yet
              </p>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        {onOpenProductivity && (
          <button
            onClick={onOpenProductivity}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Productivity</span>
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
            <span className="ml-auto text-xs text-muted-foreground">Cmd+,</span>
          </button>
        )}
      </div>

      {/* Project Dialog */}
      <ProjectDialog
        open={projectDialogOpen || !!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setProjectDialogOpen(false)
            setEditingProject(null)
          }
        }}
        project={editingProject}
        projects={userProjects}
        onSave={handleCreateProject}
        onDelete={editingProject ? handleDeleteProject : undefined}
        onArchive={editingProject ? handleArchiveProject : undefined}
        onDuplicate={editingProject ? handleDuplicateProject : undefined}
      />

      {/* Label Dialog */}
      <LabelDialog
        open={labelDialogOpen || !!editingLabel}
        onOpenChange={(open) => {
          if (!open) {
            setLabelDialogOpen(false)
            setEditingLabel(null)
          }
        }}
        label={editingLabel}
        onSave={handleSaveLabel}
        onDelete={editingLabel ? handleDeleteLabel : undefined}
      />

      {/* Filter Dialog */}
      <FilterDialog
        open={filterDialogOpen || !!editingFilter}
        onOpenChange={(open) => {
          if (!open) {
            setFilterDialogOpen(false)
            setEditingFilter(null)
          }
        }}
        filter={editingFilter}
        onSave={handleSaveFilter}
        onDelete={editingFilter ? handleDeleteFilter : undefined}
      />
    </aside>
  )
}

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  shortcut?: string
  count?: number
  onClick: () => void
  onDoubleClick?: () => void
}

function SidebarItem({
  icon,
  label,
  active,
  shortcut,
  count,
  onClick,
  onDoubleClick
}: SidebarItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'sidebar-item w-full text-left',
        active && 'active'
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
      {shortcut && (
        <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
          {shortcut}
        </span>
      )}
    </button>
  )
}

interface DroppableProjectItemProps {
  projectId: string
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  onDoubleClick?: () => void
  depth?: number
  hasChildren?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

function DroppableProjectItem({
  projectId,
  icon,
  label,
  active,
  onClick,
  onDoubleClick,
  depth = 0,
  hasChildren = false,
  isCollapsed = false,
  onToggleCollapse
}: DroppableProjectItemProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `project-${projectId}`,
    data: {
      type: 'project',
      projectId
    }
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'sidebar-item w-full text-left flex items-center',
        active && 'active',
        isOver && 'bg-primary/20 ring-2 ring-primary ring-inset'
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      {hasChildren ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse?.()
          }}
          className="p-0.5 rounded hover:bg-accent mr-1"
        >
          <ChevronRight
            className={cn(
              'w-3 h-3 transition-transform',
              !isCollapsed && 'rotate-90'
            )}
          />
        </button>
      ) : (
        <span className="w-4" /> // Spacer for alignment
      )}
      <button
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className="flex-1 flex items-center gap-2 truncate"
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    </div>
  )
}
