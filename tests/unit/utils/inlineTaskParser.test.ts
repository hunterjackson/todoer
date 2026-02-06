import { describe, it, expect } from 'vitest'
import {
  parseInlineTaskContent,
  findProjectByName,
  findSectionByName,
  findLabelByName
} from '../../../src/shared/utils/inlineTaskParser'

describe('Inline Task Parser', () => {
  describe('parseInlineTaskContent', () => {
    it('should parse simple content without modifiers', () => {
      const result = parseInlineTaskContent('Buy groceries')
      expect(result.content).toBe('Buy groceries')
      expect(result.projectName).toBeUndefined()
      expect(result.sectionName).toBeUndefined()
      expect(result.priority).toBeUndefined()
      expect(result.duration).toBeUndefined()
    })

    it('should parse project name with #', () => {
      const result = parseInlineTaskContent('Buy groceries #Shopping')
      expect(result.content).toBe('Buy groceries')
      expect(result.projectName).toBe('Shopping')
    })

    it('should parse quoted project name with spaces', () => {
      const result = parseInlineTaskContent('Buy groceries #"My Shopping List"')
      expect(result.content).toBe('Buy groceries')
      expect(result.projectName).toBe('My Shopping List')
    })

    it('should parse section name with /', () => {
      const result = parseInlineTaskContent('Buy groceries /Urgent')
      expect(result.content).toBe('Buy groceries')
      expect(result.sectionName).toBe('Urgent')
    })

    it('should parse quoted section name with spaces', () => {
      const result = parseInlineTaskContent('Buy groceries /"To Do Later"')
      expect(result.content).toBe('Buy groceries')
      expect(result.sectionName).toBe('To Do Later')
    })

    it('should parse priority p1-p4', () => {
      expect(parseInlineTaskContent('Task p1').priority).toBe(1)
      expect(parseInlineTaskContent('Task p2').priority).toBe(2)
      expect(parseInlineTaskContent('Task p3').priority).toBe(3)
      expect(parseInlineTaskContent('Task p4').priority).toBe(4)
    })

    it('should not match p5 or p0 as priority', () => {
      expect(parseInlineTaskContent('Task p5').priority).toBeUndefined()
      expect(parseInlineTaskContent('Task p0').priority).toBeUndefined()
    })

    it('should not match priority in the middle of a word', () => {
      const result = parseInlineTaskContent('Update app1 settings')
      expect(result.priority).toBeUndefined()
      expect(result.content).toBe('Update app1 settings')
    })

    it('should parse duration in minutes', () => {
      expect(parseInlineTaskContent('Task for 30 min').duration).toBe(30)
      expect(parseInlineTaskContent('Task for 45 mins').duration).toBe(45)
      expect(parseInlineTaskContent('Task for 60 minutes').duration).toBe(60)
      expect(parseInlineTaskContent('Task for 15 minute').duration).toBe(15)
    })

    it('should parse duration in hours', () => {
      expect(parseInlineTaskContent('Task for 1 hour').duration).toBe(60)
      expect(parseInlineTaskContent('Task for 2 hours').duration).toBe(120)
      expect(parseInlineTaskContent('Task for 1.5 h').duration).toBe(90)
      expect(parseInlineTaskContent('Task for 0.5 hr').duration).toBe(30)
    })

    it('should parse multiple modifiers together', () => {
      const result = parseInlineTaskContent('Write report #Work /Urgent p1 for 2 hours')
      expect(result.content).toBe('Write report')
      expect(result.projectName).toBe('Work')
      expect(result.sectionName).toBe('Urgent')
      expect(result.priority).toBe(1)
      expect(result.duration).toBe(120)
    })

    it('should handle modifiers in any order', () => {
      const result = parseInlineTaskContent('p2 Buy milk for 15 min #Shopping /Groceries')
      expect(result.content).toBe('Buy milk')
      expect(result.projectName).toBe('Shopping')
      expect(result.sectionName).toBe('Groceries')
      expect(result.priority).toBe(2)
      expect(result.duration).toBe(15)
    })

    it('should clean up extra whitespace', () => {
      const result = parseInlineTaskContent('  Task   with    spaces  #Project  ')
      expect(result.content).toBe('Task with spaces')
    })

    it('should parse reminder with !word syntax', () => {
      const result = parseInlineTaskContent('Task !tomorrow')
      expect(result.content).toBe('Task')
      expect(result.reminderText).toBe('tomorrow')
    })

    it('should parse reminder with relative time', () => {
      expect(parseInlineTaskContent('Task !10min').reminderText).toBe('10min')
      expect(parseInlineTaskContent('Task !30minutes').reminderText).toBe('30minutes')
      expect(parseInlineTaskContent('Task !1hour').reminderText).toBe('1hour')
      expect(parseInlineTaskContent('Task !2hours').reminderText).toBe('2hours')
      // With spaces, use quoted syntax
      expect(parseInlineTaskContent('Task !"30 minutes"').reminderText).toBe('30 minutes')
    })

    it('should parse reminder with quoted date', () => {
      const result = parseInlineTaskContent('Task !"Dec 25 3pm"')
      expect(result.content).toBe('Task')
      expect(result.reminderText).toBe('Dec 25 3pm')
    })

    it('should parse deadline with {date} syntax', () => {
      const result = parseInlineTaskContent('Task {tomorrow}')
      expect(result.content).toBe('Task')
      expect(result.deadlineText).toBe('tomorrow')
    })

    it('should parse deadline with complex date', () => {
      const result = parseInlineTaskContent('Task {Dec 31 2024}')
      expect(result.content).toBe('Task')
      expect(result.deadlineText).toBe('Dec 31 2024')
    })

    it('should parse both reminder and deadline', () => {
      const result = parseInlineTaskContent('Task !tomorrow {next friday}')
      expect(result.content).toBe('Task')
      expect(result.reminderText).toBe('tomorrow')
      expect(result.deadlineText).toBe('next friday')
    })

    it('should parse all modifiers together including reminder and deadline', () => {
      const result = parseInlineTaskContent('Report #Work p1 !tomorrow {friday} for 2h')
      expect(result.content).toBe('Report')
      expect(result.projectName).toBe('Work')
      expect(result.priority).toBe(1)
      expect(result.reminderText).toBe('tomorrow')
      expect(result.deadlineText).toBe('friday')
      expect(result.duration).toBe(120)
    })

    it('should parse single @label', () => {
      const result = parseInlineTaskContent('Buy milk @groceries')
      expect(result.content).toBe('Buy milk')
      expect(result.labelNames).toEqual(['groceries'])
    })

    it('should parse multiple @labels', () => {
      const result = parseInlineTaskContent('Task @urgent @work')
      expect(result.content).toBe('Task')
      expect(result.labelNames).toEqual(['urgent', 'work'])
    })

    it('should parse quoted @label with spaces', () => {
      const result = parseInlineTaskContent('Task @"follow up"')
      expect(result.content).toBe('Task')
      expect(result.labelNames).toEqual(['follow up'])
    })

    it('should parse @label with other modifiers', () => {
      const result = parseInlineTaskContent('Report #Work @urgent p1')
      expect(result.content).toBe('Report')
      expect(result.projectName).toBe('Work')
      expect(result.labelNames).toEqual(['urgent'])
      expect(result.priority).toBe(1)
    })

    it('should return undefined labelNames when no @labels present', () => {
      const result = parseInlineTaskContent('Simple task')
      expect(result.labelNames).toBeUndefined()
    })
  })

  describe('findProjectByName', () => {
    const projects = [
      { id: '1', name: 'Work' },
      { id: '2', name: 'Personal' },
      { id: '3', name: 'Shopping List' }
    ]

    it('should find exact match (case-insensitive)', () => {
      expect(findProjectByName('work', projects)?.id).toBe('1')
      expect(findProjectByName('WORK', projects)?.id).toBe('1')
      expect(findProjectByName('Work', projects)?.id).toBe('1')
    })

    it('should find prefix match', () => {
      expect(findProjectByName('shop', projects)?.id).toBe('3')
      expect(findProjectByName('per', projects)?.id).toBe('2')
    })

    it('should find contains match', () => {
      expect(findProjectByName('list', projects)?.id).toBe('3')
    })

    it('should return undefined if not found', () => {
      expect(findProjectByName('nonexistent', projects)).toBeUndefined()
    })
  })

  describe('findSectionByName', () => {
    const sections = [
      { id: '1', name: 'To Do', projectId: 'proj1' },
      { id: '2', name: 'In Progress', projectId: 'proj1' },
      { id: '3', name: 'Done', projectId: 'proj1' },
      { id: '4', name: 'To Do', projectId: 'proj2' }
    ]

    it('should find exact match within project', () => {
      expect(findSectionByName('To Do', sections, 'proj1')?.id).toBe('1')
      expect(findSectionByName('To Do', sections, 'proj2')?.id).toBe('4')
    })

    it('should find section case-insensitively', () => {
      expect(findSectionByName('to do', sections, 'proj1')?.id).toBe('1')
      expect(findSectionByName('IN PROGRESS', sections, 'proj1')?.id).toBe('2')
    })

    it('should find prefix match', () => {
      expect(findSectionByName('In', sections, 'proj1')?.id).toBe('2')
    })

    it('should find across all projects if no projectId specified', () => {
      const result = findSectionByName('Done', sections)
      expect(result?.id).toBe('3')
    })

    it('should return undefined if not found', () => {
      expect(findSectionByName('Nonexistent', sections, 'proj1')).toBeUndefined()
    })
  })

  describe('findLabelByName', () => {
    const labels = [
      { id: '1', name: 'urgent' },
      { id: '2', name: 'follow up' },
      { id: '3', name: 'Work' }
    ]

    it('should find exact match (case-insensitive)', () => {
      expect(findLabelByName('urgent', labels)?.id).toBe('1')
      expect(findLabelByName('URGENT', labels)?.id).toBe('1')
      expect(findLabelByName('Work', labels)?.id).toBe('3')
    })

    it('should find prefix match', () => {
      expect(findLabelByName('fol', labels)?.id).toBe('2')
    })

    it('should find contains match', () => {
      expect(findLabelByName('up', labels)?.id).toBe('2')
    })

    it('should return undefined if not found', () => {
      expect(findLabelByName('nonexistent', labels)).toBeUndefined()
    })
  })
})
