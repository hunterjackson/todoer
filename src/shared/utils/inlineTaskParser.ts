import type { Priority } from '../types'

export interface ParsedTaskContent {
  content: string
  projectName?: string
  sectionName?: string
  priority?: Priority
  duration?: number  // in minutes
  reminderText?: string  // Raw reminder text to be parsed by date parser
  deadlineText?: string  // Raw deadline text to be parsed by date parser
}

/**
 * Parse inline task modifiers from task content.
 * Supported syntax:
 * - #projectname - assign to project
 * - /sectionname - assign to section
 * - p1, p2, p3, p4 - set priority
 * - "for X min/hour/minutes/hours" - set duration
 * - !datetime - set reminder (e.g., !tomorrow, !10min, !"Dec 25 3pm")
 * - {datetime} - set deadline (e.g., {tomorrow}, {Dec 25})
 */
export function parseInlineTaskContent(input: string): ParsedTaskContent {
  let content = input
  const result: ParsedTaskContent = { content: '' }

  // Parse project (#projectname)
  // Match #word or #"quoted words"
  const projectMatch = content.match(/#(?:"([^"]+)"|(\S+))/)
  if (projectMatch) {
    result.projectName = projectMatch[1] || projectMatch[2]
    content = content.replace(projectMatch[0], '').trim()
  }

  // Parse section (/sectionname)
  // Match /word or /"quoted words"
  const sectionMatch = content.match(/\/(?:"([^"]+)"|(\S+))/)
  if (sectionMatch) {
    result.sectionName = sectionMatch[1] || sectionMatch[2]
    content = content.replace(sectionMatch[0], '').trim()
  }

  // Parse priority (p1, p2, p3, p4)
  // Must be standalone word (not part of another word)
  const priorityMatch = content.match(/\bp([1-4])\b/)
  if (priorityMatch) {
    result.priority = parseInt(priorityMatch[1]) as Priority
    content = content.replace(priorityMatch[0], '').trim()
  }

  // Parse duration ("for X min/hour/minutes/hours")
  const durationMatch = content.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|h(?:our)?s?|hr?s?)\b/i)
  if (durationMatch) {
    const value = parseFloat(durationMatch[1])
    const unit = durationMatch[2].toLowerCase()

    if (unit.startsWith('h')) {
      result.duration = Math.round(value * 60)  // Convert hours to minutes
    } else {
      result.duration = Math.round(value)
    }
    content = content.replace(durationMatch[0], '').trim()
  }

  // Parse reminder (!datetime)
  // Match !"quoted text" or !word (for single word like !tomorrow)
  // Also match relative time like !10min, !1hour
  const reminderMatch = content.match(/!(?:"([^"]+)"|(\d+\s*(?:min(?:ute)?s?|h(?:our)?s?|hr?s?))|(\S+))/)
  if (reminderMatch) {
    // Could be quoted ("..."), relative time (10min), or single word (tomorrow)
    result.reminderText = reminderMatch[1] || reminderMatch[2] || reminderMatch[3]
    content = content.replace(reminderMatch[0], '').trim()
  }

  // Parse deadline ({datetime})
  // Match {any text until closing brace}
  const deadlineMatch = content.match(/\{([^}]+)\}/)
  if (deadlineMatch) {
    result.deadlineText = deadlineMatch[1].trim()
    content = content.replace(deadlineMatch[0], '').trim()
  }

  // Clean up multiple spaces
  result.content = content.replace(/\s+/g, ' ').trim()

  return result
}

/**
 * Find a project by name (case-insensitive partial match)
 */
export function findProjectByName(
  projectName: string,
  projects: { id: string; name: string }[]
): { id: string; name: string } | undefined {
  const lowerName = projectName.toLowerCase()

  // First try exact match (case-insensitive)
  const exactMatch = projects.find(p => p.name.toLowerCase() === lowerName)
  if (exactMatch) return exactMatch

  // Then try prefix match
  const prefixMatch = projects.find(p => p.name.toLowerCase().startsWith(lowerName))
  if (prefixMatch) return prefixMatch

  // Finally try contains match
  return projects.find(p => p.name.toLowerCase().includes(lowerName))
}

/**
 * Find a section by name (case-insensitive partial match) within a project
 */
export function findSectionByName(
  sectionName: string,
  sections: { id: string; name: string; projectId: string }[],
  projectId?: string
): { id: string; name: string; projectId: string } | undefined {
  const lowerName = sectionName.toLowerCase()

  // Filter by project if specified
  const relevantSections = projectId
    ? sections.filter(s => s.projectId === projectId)
    : sections

  // First try exact match (case-insensitive)
  const exactMatch = relevantSections.find(s => s.name.toLowerCase() === lowerName)
  if (exactMatch) return exactMatch

  // Then try prefix match
  const prefixMatch = relevantSections.find(s => s.name.toLowerCase().startsWith(lowerName))
  if (prefixMatch) return prefixMatch

  // Finally try contains match
  return relevantSections.find(s => s.name.toLowerCase().includes(lowerName))
}
