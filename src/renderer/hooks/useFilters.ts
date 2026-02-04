import { useState, useEffect, useCallback } from 'react'
import type { Filter, FilterCreate, FilterUpdate } from '@shared/types'

interface UseFiltersResult {
  filters: Filter[]
  loading: boolean
  error: string | null
  createFilter: (data: FilterCreate) => Promise<Filter>
  updateFilter: (id: string, data: FilterUpdate) => Promise<Filter | null>
  deleteFilter: (id: string) => Promise<boolean>
  evaluateFilter: (query: string) => Promise<any[]>
  refresh: () => Promise<void>
}

export function useFilters(): UseFiltersResult {
  const [filters, setFilters] = useState<Filter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFilters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.api.filters.list()
      setFilters(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch filters')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFilters()
  }, [fetchFilters])

  const createFilter = useCallback(async (data: FilterCreate): Promise<Filter> => {
    const filter = await window.api.filters.create(data)
    await fetchFilters()
    return filter
  }, [fetchFilters])

  const updateFilter = useCallback(async (id: string, data: FilterUpdate): Promise<Filter | null> => {
    const filter = await window.api.filters.update(id, data)
    await fetchFilters()
    return filter
  }, [fetchFilters])

  const deleteFilter = useCallback(async (id: string): Promise<boolean> => {
    const result = await window.api.filters.delete(id)
    await fetchFilters()
    return result
  }, [fetchFilters])

  const evaluateFilter = useCallback(async (query: string): Promise<any[]> => {
    return window.api.filters.evaluate(query)
  }, [])

  return {
    filters,
    loading,
    error,
    createFilter,
    updateFilter,
    deleteFilter,
    evaluateFilter,
    refresh: fetchFilters
  }
}
