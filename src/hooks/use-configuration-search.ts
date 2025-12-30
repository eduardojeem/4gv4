'use client'

import { useState, useMemo, useCallback } from 'react'
import { ConfigurationGroup, ConfigurationSetting, SearchResult } from '@/types/settings'

export function useConfigurationSearch(groups: ConfigurationGroup[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Función para calcular la relevancia de un resultado
  const calculateRelevance = useCallback((
    setting: ConfigurationSetting,
    query: string
  ): number => {
    const normalizedQuery = query.toLowerCase().trim()
    if (!normalizedQuery) return 0

    let score = 0
    const queryWords = normalizedQuery.split(' ')

    // Coincidencia exacta en título (peso alto)
    if (setting.title.toLowerCase().includes(normalizedQuery)) {
      score += 100
    }

    // Coincidencia exacta en descripción (peso medio)
    if (setting.description.toLowerCase().includes(normalizedQuery)) {
      score += 50
    }

    // Coincidencia en palabras clave (peso alto)
    setting.searchKeywords.forEach(keyword => {
      if (keyword.toLowerCase().includes(normalizedQuery)) {
        score += 80
      }
    })

    // Coincidencia parcial en palabras individuales
    queryWords.forEach(word => {
      if (word.length > 2) {
        if (setting.title.toLowerCase().includes(word)) score += 30
        if (setting.description.toLowerCase().includes(word)) score += 20
        setting.searchKeywords.forEach(keyword => {
          if (keyword.toLowerCase().includes(word)) score += 25
        })
      }
    })

    // Bonus por coincidencia al inicio de palabras
    if (setting.title.toLowerCase().startsWith(normalizedQuery)) {
      score += 50
    }

    return score
  }, [])

  // Función de búsqueda principal
  const searchResults = useMemo((): SearchResult[] => {
    if (!searchQuery.trim()) return []

    const results: SearchResult[] = []

    groups.forEach(group => {
      group.sections.forEach(section => {
        section.settings.forEach(setting => {
          // Filtrar por categoría si está seleccionada
          if (selectedCategory && setting.category !== selectedCategory) {
            return
          }

          const relevanceScore = calculateRelevance(setting, searchQuery)
          
          if (relevanceScore > 0) {
            results.push({
              setting,
              section,
              group,
              relevanceScore
            })
          }
        })
      })
    })

    // Ordenar por relevancia (mayor a menor)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore)
  }, [searchQuery, selectedCategory, groups, calculateRelevance])

  // Obtener categorías únicas para el filtro
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    groups.forEach(group => {
      group.sections.forEach(section => {
        section.settings.forEach(setting => {
          categories.add(setting.category)
        })
      })
    })
    return Array.from(categories)
  }, [groups])

  // Función para limpiar la búsqueda
  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSelectedCategory(null)
  }, [])

  // Función para buscar configuraciones por ID
  const findSettingById = useCallback((settingId: string) => {
    for (const group of groups) {
      for (const section of group.sections) {
        const setting = section.settings.find(s => s.id === settingId)
        if (setting) {
          return { setting, section, group }
        }
      }
    }
    return null
  }, [groups])

  // Función para obtener configuraciones por categoría
  const getSettingsByCategory = useCallback((category: string) => {
    const results: SearchResult[] = []
    
    groups.forEach(group => {
      group.sections.forEach(section => {
        section.settings.forEach(setting => {
          if (setting.category === category) {
            results.push({
              setting,
              section,
              group,
              relevanceScore: 100 // Todas tienen la misma relevancia en este caso
            })
          }
        })
      })
    })

    return results
  }, [groups])

  // Función para obtener sugerencias de búsqueda
  const getSearchSuggestions = useCallback((query: string) => {
    if (!query.trim() || query.length < 2) return []

    const suggestions = new Set<string>()
    const normalizedQuery = query.toLowerCase()

    groups.forEach(group => {
      // Sugerencias de títulos de grupos
      if (group.title.toLowerCase().includes(normalizedQuery)) {
        suggestions.add(group.title)
      }

      group.sections.forEach(section => {
        // Sugerencias de títulos de secciones
        if (section.title.toLowerCase().includes(normalizedQuery)) {
          suggestions.add(section.title)
        }

        section.settings.forEach(setting => {
          // Sugerencias de títulos de configuraciones
          if (setting.title.toLowerCase().includes(normalizedQuery)) {
            suggestions.add(setting.title)
          }

          // Sugerencias de palabras clave
          setting.searchKeywords.forEach(keyword => {
            if (keyword.toLowerCase().includes(normalizedQuery)) {
              suggestions.add(keyword)
            }
          })
        })
      })
    })

    return Array.from(suggestions).slice(0, 8) // Limitar a 8 sugerencias
  }, [groups])

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    searchResults,
    availableCategories,
    clearSearch,
    findSettingById,
    getSettingsByCategory,
    getSearchSuggestions,
    hasResults: searchResults.length > 0,
    isSearching: searchQuery.trim().length > 0
  }
}