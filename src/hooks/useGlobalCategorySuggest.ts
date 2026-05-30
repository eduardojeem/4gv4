/**
 * Hook para sugerencias de categorías globales.
 * Hace debounce de 400ms para no spamear la API mientras el usuario escribe.
 */
import { useState, useEffect, useRef } from 'react'

export interface GlobalCategorySuggestion {
  id: string
  name: string
  slug: string
  level: number
  parent_name: string | null
  similarity: number
}

interface UseGlobalCategorySuggestResult {
  suggestions: GlobalCategorySuggestion[]
  isLoading: boolean
  dismiss: () => void
}

export function useGlobalCategorySuggest(
  name: string,
  enabled = true
): UseGlobalCategorySuggestResult {
  const [suggestions, setSuggestions] = useState<GlobalCategorySuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastNameRef = useRef('')

  useEffect(() => {
    // Reset dismissed cuando el nombre cambia significativamente
    if (Math.abs(name.length - lastNameRef.current.length) > 2) {
      setDismissed(false)
    }
    lastNameRef.current = name
  }, [name])

  useEffect(() => {
    if (!enabled || dismissed || name.trim().length < 2) {
      setSuggestions([])
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/categories/suggest?name=${encodeURIComponent(name.trim())}`
        )
        if (!res.ok) return
        const json = await res.json()
        if (json.success) {
          // Solo mostrar si hay match con >= 30% de similitud
          setSuggestions(
            (json.data as GlobalCategorySuggestion[]).filter(
              (s) => s.similarity >= 0.3
            )
          )
        }
      } catch {
        // fail silently — las sugerencias son opcionales
      } finally {
        setIsLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [name, enabled, dismissed])

  return {
    suggestions,
    isLoading,
    dismiss: () => {
      setDismissed(true)
      setSuggestions([])
    },
  }
}
