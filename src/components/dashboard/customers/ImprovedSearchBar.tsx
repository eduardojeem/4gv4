"use client"

/**
 * ImprovedSearchBar
 * 
 * Barra de búsqueda inteligente mejorada con:
 * - Búsqueda en tiempo real con debounce optimizado
 * - Sugerencias inteligentes por tipo de campo
 * - Búsqueda fuzzy (tolerante a errores de escritura)
 * - Filtros rápidos por categorías
 * - Historial de búsquedas con persistencia
 * - Atajos de teclado avanzados
 * - Búsqueda por múltiples campos simultáneamente
 * - Resaltado de coincidencias
 * - Búsqueda por patrones (email, teléfono, etc.)
 */

import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  X, 
  Loader2, 
  Command,
  Clock,
  TrendingUp,
  User,
  Mail,
  Phone,
  MapPin,
  Hash,
  Building,
  Filter,
  Zap,
  Star
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CustomerPreview } from "./CustomerPreview"
import { cn } from "@/lib/utils"
import { Customer } from "@/hooks/use-customer-state"

interface SearchSuggestion {
  value: string
  type: 'name' | 'email' | 'phone' | 'city' | 'code' | 'company' | 'ruc'
  icon: React.ReactNode
  customer?: Customer
  score?: number
  matchedField?: string
}

interface QuickFilter {
  label: string
  icon: React.ReactNode
  query: string
  description: string
}

interface ImprovedSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  customers?: Customer[]
  isSearching?: boolean
  placeholder?: string
  className?: string
  onQuickFilter?: (filter: string) => void
  onCustomerSelect?: (customer: Customer) => void // Nueva prop para seleccionar cliente
}

export function ImprovedSearchBar({
  value,
  onChange,
  onSearch,
  customers = [],
  isSearching = false,
  placeholder = "Buscar clientes por nombre, email, teléfono, código...",
  className,
  onQuickFilter,
  onCustomerSelect
}: ImprovedSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showQuickFilters, setShowQuickFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Quick filters for common searches
  const quickFilters: QuickFilter[] = [
    {
      label: "VIP",
      icon: <Star className="h-4 w-4" />,
      query: "customer_type:premium",
      description: "Clientes VIP y Premium"
    },
    {
      label: "Empresas",
      icon: <Building className="h-4 w-4" />,
      query: "customer_type:empresa",
      description: "Clientes empresariales"
    },
    {
      label: "Montevideo",
      icon: <MapPin className="h-4 w-4" />,
      query: "city:Montevideo",
      description: "Clientes de Montevideo"
    },
    {
      label: "Activos",
      icon: <Zap className="h-4 w-4" />,
      query: "status:active",
      description: "Clientes activos"
    }
  ]

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): number => {
    if (!text || !query) return 0
    
    text = text.toLowerCase()
    query = query.toLowerCase()
    
    // Exact match gets highest score
    if (text.includes(query)) return 100
    
    // Calculate fuzzy score based on character matches
    let score = 0
    let queryIndex = 0
    
    for (let i = 0; i < text.length && queryIndex < query.length; i++) {
      if (text[i] === query[queryIndex]) {
        score += 1
        queryIndex++
      }
    }
    
    return queryIndex === query.length ? (score / query.length) * 80 : 0
  }

  // Generate intelligent suggestions
  const suggestions = useMemo(() => {
    if (!value || value.length < 2) return []
    
    const searchTerm = value.toLowerCase().trim()
    const results: SearchSuggestion[] = []
    
    // Detect search patterns
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchTerm)
    const isPhone = /^[\d\s\-\+\(\)]+$/.test(searchTerm) && searchTerm.replace(/\D/g, '').length >= 8
    const isRUC = /^\d{12}$/.test(searchTerm.replace(/\D/g, ''))
    const isCode = /^CLI-/.test(searchTerm.toUpperCase())
    
    customers.forEach(customer => {
      // Name search with fuzzy matching
      const nameScore = fuzzyMatch(customer.name || '', searchTerm)
      if (nameScore > 30) {
        results.push({
          value: customer.name,
          type: 'name',
          icon: <User className="h-4 w-4" />,
          customer,
          score: nameScore,
          matchedField: 'name'
        })
      }
      
      // Email search
      if (customer.email && (isEmail || customer.email.toLowerCase().includes(searchTerm))) {
        const emailScore = customer.email.toLowerCase().includes(searchTerm) ? 90 : 70
        results.push({
          value: customer.email,
          type: 'email',
          icon: <Mail className="h-4 w-4" />,
          customer,
          score: emailScore,
          matchedField: 'email'
        })
      }
      
      // Phone search
      if (customer.phone && (isPhone || customer.phone.includes(searchTerm))) {
        const phoneScore = customer.phone.includes(searchTerm) ? 90 : 70
        results.push({
          value: customer.phone,
          type: 'phone',
          icon: <Phone className="h-4 w-4" />,
          customer,
          score: phoneScore,
          matchedField: 'phone'
        })
      }
      
      // City search
      if (customer.city && customer.city.toLowerCase().includes(searchTerm)) {
        results.push({
          value: customer.city,
          type: 'city',
          icon: <MapPin className="h-4 w-4" />,
          customer,
          score: 85,
          matchedField: 'city'
        })
      }
      
      // Customer code search
      if (customer.customerCode && (isCode || customer.customerCode.toLowerCase().includes(searchTerm))) {
        const codeScore = customer.customerCode.toLowerCase().includes(searchTerm) ? 95 : 75
        results.push({
          value: customer.customerCode,
          type: 'code',
          icon: <Hash className="h-4 w-4" />,
          customer,
          score: codeScore,
          matchedField: 'customerCode'
        })
      }
      
      // Company search
      if (customer.company && customer.company.toLowerCase().includes(searchTerm)) {
        results.push({
          value: customer.company,
          type: 'company',
          icon: <Building className="h-4 w-4" />,
          customer,
          score: 80,
          matchedField: 'company'
        })
      }
      
      // RUC search
      if (customer.ruc && (isRUC || customer.ruc.includes(searchTerm))) {
        const rucScore = customer.ruc.includes(searchTerm) ? 95 : 75
        results.push({
          value: customer.ruc,
          type: 'ruc',
          icon: <Hash className="h-4 w-4" />,
          customer,
          score: rucScore,
          matchedField: 'ruc'
        })
      }
    })
    
    // Remove duplicates and sort by score
    const uniqueResults = results
      .filter((result, index, self) => 
        index === self.findIndex(r => r.value === result.value && r.type === result.type)
      )
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 8) // Limit to 8 suggestions
    
    return uniqueResults
  }, [value, customers])

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customer-search-history')
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        console.error('Error loading search history:', e)
      }
    }
  }, [])

  // Save search to history
  const saveToHistory = (searchTerm: string) => {
    if (!searchTerm.trim()) return
    
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 8)
    setRecentSearches(updated)
    localStorage.setItem('customer-search-history', JSON.stringify(updated))
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowQuickFilters(!showQuickFilters)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showQuickFilters])

  // Handle navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    const totalSuggestions = suggestions.length + recentSearches.length

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalSuggestions)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalSuggestions) % totalSuggestions)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            // Seleccionar sugerencia inteligente
            handleSelectSuggestion(suggestions[selectedIndex])
          } else {
            // Seleccionar búsqueda reciente
            const recentSearch = recentSearches[selectedIndex - suggestions.length]
            onChange(recentSearch)
            saveToHistory(recentSearch)
            setShowSuggestions(false)
            setSelectedIndex(-1)
            onSearch?.(recentSearch)
          }
        } else if (value.trim()) {
          handleSearch()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (showQuickFilters) {
          e.preventDefault()
          setShowQuickFilters(false)
        }
        break
    }
  }

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    // Si la sugerencia tiene un cliente asociado, mostrar su detalle
    if (suggestion.customer && onCustomerSelect) {
      onCustomerSelect(suggestion.customer)
      setShowSuggestions(false)
      setSelectedIndex(-1)
      // También actualizar el valor de búsqueda con el nombre del cliente
      onChange(suggestion.customer.name)
      saveToHistory(suggestion.customer.name)
    } else {
      // Comportamiento normal de búsqueda
      onChange(suggestion.value)
      saveToHistory(suggestion.value)
      setShowSuggestions(false)
      setSelectedIndex(-1)
      onSearch?.(suggestion.value)
    }
  }

  const handleSelectRecentSearch = (search: string) => {
    onChange(search)
    saveToHistory(search)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    onSearch?.(search)
  }

  const handleQuickFilter = (filter: QuickFilter) => {
    onChange(filter.query)
    saveToHistory(filter.query)
    setShowQuickFilters(false)
    onQuickFilter?.(filter.query)
    onSearch?.(filter.query)
  }

  const handleSearch = () => {
    if (value.trim()) {
      saveToHistory(value)
      onSearch?.(value)
    }
    setShowSuggestions(false)
  }

  const handleClear = () => {
    onChange('')
    setShowSuggestions(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const clearHistory = () => {
    setRecentSearches([])
    localStorage.removeItem('customer-search-history')
  }

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Search Input */}
      <div
        className={cn(
          "relative flex items-center gap-2 rounded-xl border-2 bg-white dark:bg-slate-900 transition-all duration-200",
          isFocused
            ? "border-blue-500 shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10"
            : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
        )}
      >
        {/* Search Icon */}
        <div className="pl-4">
          {isSearching ? (
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
          ) : (
            <Search className={cn(
              "h-5 w-5 transition-colors",
              isFocused ? "text-blue-500" : "text-gray-400"
            )} />
          )}
        </div>

        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowSuggestions(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => {
            setIsFocused(true)
            if (value || recentSearches.length > 0 || suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          onBlur={() => {
            setIsFocused(false)
            // Delay to allow clicking on suggestions
            setTimeout(() => {
              setShowSuggestions(false)
              setShowQuickFilters(false)
            }, 200)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 py-6"
        />

        {/* Quick Filters Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowQuickFilters(!showQuickFilters)}
          className={cn(
            "p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors",
            showQuickFilters && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          )}
          aria-label="Filtros rápidos"
        >
          <Filter className="h-4 w-4" />
        </Button>

        {/* Clear Button */}
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleClear}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4 text-gray-400" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Keyboard Shortcut Hint */}
        {!isFocused && !value && (
          <div className="pr-4 flex items-center gap-1 text-xs text-gray-400">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Quick Filters Dropdown */}
      <AnimatePresence>
        {showQuickFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="p-3">
              <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                <Filter className="h-3 w-3" />
                <span>Filtros Rápidos</span>
                <Badge variant="secondary" className="text-xs">Ctrl+F</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {quickFilters.map((filter, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuickFilter(filter)}
                    className="flex items-center gap-2 justify-start h-auto p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {filter.icon}
                    <div className="text-left">
                      <div className="font-medium text-sm">{filter.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{filter.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && !showQuickFilters && (suggestions.length > 0 || recentSearches.length > 0) && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-96 overflow-y-auto"
          >
            {/* Recent Searches */}
            {recentSearches.length > 0 && !value && (
              <div className="p-2 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3" />
                    <span>Búsquedas recientes</span>
                  </div>
                  <button
                    onClick={clearHistory}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Limpiar
                  </button>
                </div>
                {recentSearches.slice(0, 5).map((search, index) => (
                  <button
                    key={`recent-${index}`}
                    onClick={() => handleSelectRecentSearch(search)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      selectedIndex === suggestions.length + index
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{search}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Intelligent Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <TrendingUp className="h-3 w-3" />
                  <span>Sugerencias inteligentes</span>
                  <Badge variant="secondary" className="text-xs">{suggestions.length}</Badge>
                </div>
                {suggestions.map((suggestion, index) => {
                  const SuggestionButton = (
                    <button
                      key={`suggestion-${index}`}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group",
                        selectedIndex === index
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                      )}
                    >
                      {suggestion.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {highlightMatch(suggestion.value, value)}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {suggestion.type}
                          </Badge>
                          {suggestion.score && suggestion.score > 90 && (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              Exacta
                            </Badge>
                          )}
                        </div>
                        {suggestion.customer && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3" />
                              <span>{suggestion.customer.name}</span>
                              {suggestion.customer.email && (
                                <>
                                  <span>•</span>
                                  <span>{suggestion.customer.email}</span>
                                </>
                              )}
                              {suggestion.customer.phone && (
                                <>
                                  <span>•</span>
                                  <span>{suggestion.customer.phone}</span>
                                </>
                              )}
                            </div>
                            {onCustomerSelect && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                👆 Clic para ver detalles del cliente
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  )

                  // Si hay un cliente asociado, envolver en Popover para vista previa
                  if (suggestion.customer && onCustomerSelect) {
                    return (
                      <Popover key={`suggestion-${index}`}>
                        <PopoverTrigger asChild>
                          {SuggestionButton}
                        </PopoverTrigger>
                        <PopoverContent 
                          side="right" 
                          className="w-auto p-0 border-0 shadow-xl"
                          sideOffset={10}
                        >
                          <CustomerPreview
                            customer={suggestion.customer}
                            onViewDetails={(customer) => {
                              onCustomerSelect(customer)
                              setShowSuggestions(false)
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    )
                  }

                  return SuggestionButton
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Tips */}
      {isFocused && !value && suggestions.length === 0 && recentSearches.length === 0 && !showQuickFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full mt-2 p-4 bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 rounded-xl shadow-xl"
        >
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            💡 Búsqueda Inteligente
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <p className="font-medium mb-1">Buscar por:</p>
              <ul className="space-y-1">
                <li>• Nombre del cliente</li>
                <li>• Email o teléfono</li>
                <li>• Código de cliente</li>
                <li>• Ciudad o empresa</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Atajos:</p>
              <ul className="space-y-1">
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">Ctrl+K</kbd> Enfocar búsqueda</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">Ctrl+F</kbd> Filtros rápidos</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">↑↓</kbd> Navegar sugerencias</li>
                <li>• <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">Enter</kbd> Buscar</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
