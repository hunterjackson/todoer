import { useState, useEffect, useCallback } from 'react'
import type { Label, LabelCreate, LabelUpdate } from '@shared/types'

// Global event for label data changes
export const LABELS_CHANGED_EVENT = 'todoer:labels-changed'

// Utility function to notify all label hooks of changes
export function notifyLabelsChanged(): void {
  window.dispatchEvent(new CustomEvent(LABELS_CHANGED_EVENT))
}

interface UseLabelsResult {
  labels: Label[]
  loading: boolean
  error: string | null
  createLabel: (data: LabelCreate) => Promise<Label>
  updateLabel: (id: string, data: LabelUpdate) => Promise<Label | null>
  deleteLabel: (id: string) => Promise<boolean>
  refresh: () => Promise<void>
}

export function useLabels(): UseLabelsResult {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLabels = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.labels.list()
      setLabels(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch labels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLabels()
  }, [fetchLabels])

  // Listen for global label change events
  useEffect(() => {
    const handleLabelsChanged = () => {
      fetchLabels()
    }
    window.addEventListener(LABELS_CHANGED_EVENT, handleLabelsChanged)
    return () => window.removeEventListener(LABELS_CHANGED_EVENT, handleLabelsChanged)
  }, [fetchLabels])

  const createLabel = useCallback(async (data: LabelCreate): Promise<Label> => {
    const label = await window.api.labels.create(data)
    await fetchLabels()
    notifyLabelsChanged()
    return label
  }, [fetchLabels])

  const updateLabel = useCallback(async (id: string, data: LabelUpdate): Promise<Label | null> => {
    const label = await window.api.labels.update(id, data)
    await fetchLabels()
    notifyLabelsChanged()
    return label
  }, [fetchLabels])

  const deleteLabel = useCallback(async (id: string): Promise<boolean> => {
    const result = await window.api.labels.delete(id)
    await fetchLabels()
    notifyLabelsChanged()
    return result
  }, [fetchLabels])

  return {
    labels,
    loading,
    error,
    createLabel,
    updateLabel,
    deleteLabel,
    refresh: fetchLabels
  }
}
