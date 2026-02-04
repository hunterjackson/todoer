import React, { useState } from 'react'
import {
  CalendarDays,
  Inbox,
  Calendar,
  CalendarRange,
  Search,
  Plus,
  Hash,
  Filter,
  Settings
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
import type { ViewType, ProjectCreate, ProjectUpdate, LabelCreate, LabelUpdate, FilterCreate, FilterUpdate } from '@shared/types'
import { INBOX_PROJECT_ID } from '@shared/constants'

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType, id?: string) => void
  onQuickAdd: () => void
  onOpenSettings?: () => void
}

export function Sidebar({ currentView, onViewChange, onQuickAdd, onOpenSettings }: SidebarProps): React.ReactElement {
  const { projects, createProject } = useProjects()
  const { labels, createLabel } = useLabels()
  const { filters, createFilter } = useFilters()
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [labelDialogOpen, setLabelDialogOpen] = useState(false)
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)

  const userProjects = projects.filter((p) => p.id !== INBOX_PROJECT_ID)

  const handleCreateProject = async (data: ProjectCreate | ProjectUpdate) => {
    await createProject(data as ProjectCreate)
  }

  const handleCreateLabel = async (data: LabelCreate | LabelUpdate) => {
    await createLabel(data as LabelCreate)
  }

  const handleCreateFilter = async (data: FilterCreate | FilterUpdate) => {
    await createFilter(data as FilterCreate)
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
                active={currentView === 'filter'}
                onClick={() => onViewChange('filter', filter.id)}
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
            {userProjects.map((project) => (
              <DroppableProjectItem
                key={project.id}
                projectId={project.id}
                icon={
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                }
                label={project.name}
                active={currentView === 'project'}
                onClick={() => onViewChange('project', project.id)}
              />
            ))}
            {userProjects.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No projects yet
              </p>
            )}
          </div>
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
                icon={<Hash className="w-4 h-4" style={{ color: label.color }} />}
                label={label.name}
                active={currentView === 'label'}
                onClick={() => onViewChange('label', label.id)}
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
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        onSave={handleCreateProject}
      />

      {/* Label Dialog */}
      <LabelDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        onSave={handleCreateLabel}
      />

      {/* Filter Dialog */}
      <FilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        onSave={handleCreateFilter}
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
}

function SidebarItem({
  icon,
  label,
  active,
  shortcut,
  count,
  onClick
}: SidebarItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
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
}

function DroppableProjectItem({
  projectId,
  icon,
  label,
  active,
  onClick
}: DroppableProjectItemProps): React.ReactElement {
  const { isOver, setNodeRef } = useDroppable({
    id: `project-${projectId}`,
    data: {
      type: 'project',
      projectId
    }
  })

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'sidebar-item w-full text-left',
        active && 'active',
        isOver && 'bg-primary/20 ring-2 ring-primary ring-inset'
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}
