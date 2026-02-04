import { useState, useEffect, useCallback } from 'react'
import type { Section } from '@shared/types'

interface SectionCreate {
  name: string
  projectId: string
}

interface SectionUpdate {
  name?: string
  isCollapsed?: boolean
}

export function useSections(projectId: string | undefined) {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSections = useCallback(async () => {
    if (!projectId) {
      setSections([])
      setLoading(false)
      return
    }

    try {
      const data = await window.api.sections.list(projectId)
      setSections(data)
    } catch (err) {
      console.error('Failed to fetch sections:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  const createSection = useCallback(
    async (data: SectionCreate) => {
      const section = await window.api.sections.create(data)
      setSections((prev) => [...prev, section])
      return section
    },
    []
  )

  const updateSection = useCallback(
    async (id: string, data: SectionUpdate) => {
      const updated = await window.api.sections.update(id, data)
      setSections((prev) =>
        prev.map((s) => (s.id === id ? updated : s))
      )
      return updated
    },
    []
  )

  const deleteSection = useCallback(async (id: string) => {
    await window.api.sections.delete(id)
    setSections((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const reorderSection = useCallback(
    async (sectionId: string, newOrder: number) => {
      await window.api.sections.reorder(sectionId, newOrder)
      await fetchSections()
    },
    [fetchSections]
  )

  return {
    sections,
    loading,
    createSection,
    updateSection,
    deleteSection,
    reorderSection,
    refresh: fetchSections
  }
}
