'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Filter, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ConfigurationSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
  availableCategories: string[]
  suggestions: string[]
  onSuggestionSelect: (suggestion: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
}

const categoryLabels: Record<string, string> = {
  appearance: 'Apariencia',
  system: 'Sistema',
  notifications: 'Notificaciones',
  catalog: 'Catálogo',
  security: 'Seguridad',
  backup: 'Respaldos'
}

export function ConfigurationSearch({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  availableCategories,
  suggestions,
  onSuggestionSelect,
  onClear,
  placeholder = 'Buscar configuraciones...',
  className
}: ConfigurationSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Mostrar sugerencias cuando hay texto y sugerencias disponibles
  useEffect(() => {
    setShowSuggestions(searchQuery.length > 1 && suggestions.length > 0)
  }, [searchQuery, suggestions])

  const handleInputChange = (value: string) => {
    onSearchChange(value)
    setShowSuggestions(value.length > 1 && suggestions.length > 0)
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSuggestionSelect(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleClear = () => {
    onClear()
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={cn('relative space-y-3', className)}>
      {/* Barra de búsqueda principal */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(searchQuery.length > 1 && suggestions.length > 0)}
            className="pl-10 pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            
            {/* Filtro por categoría */}
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 px-2 text-xs',
                    selectedCategory && 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  )}
                >
                  <Filter className="h-3 w-3 mr-1" />
                  {selectedCategory ? categoryLabels[selectedCategory] || selectedCategory : 'Todo'}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filtrar por categoría</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onCategoryChange(null)}
                  className={cn(!selectedCategory && 'bg-gray-50 dark:bg-gray-800')}
                >
                  Todas las categorías
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableCategories.map((category) => (
                  <DropdownMenuItem
                    key={category}
                    onClick={() => onCategoryChange(category)}
                    className={cn(selectedCategory === category && 'bg-blue-50 dark:bg-blue-950')}
                  >
                    {categoryLabels[category] || category}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Sugerencias de autocompletado */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1">
            <div className="rounded-md border bg-white dark:bg-gray-950 shadow-lg">
              <Command>
                <CommandList>
                  <CommandEmpty>No se encontraron sugerencias</CommandEmpty>
                  <CommandGroup heading="Sugerencias">
                    {suggestions.map((suggestion, index) => (
                      <CommandItem
                        key={index}
                        onSelect={() => handleSuggestionClick(suggestion)}
                        className="cursor-pointer"
                      >
                        <Search className="mr-2 h-3 w-3 text-gray-400" />
                        {suggestion}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
        )}
      </div>

      {/* Filtros activos */}
      {(searchQuery || selectedCategory) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Filtros activos:</span>
          {searchQuery && (
            <Badge variant="secondary" className="text-xs">
              Búsqueda: "{searchQuery}"
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange('')}
                className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="secondary" className="text-xs">
              Categoría: {categoryLabels[selectedCategory] || selectedCategory}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCategoryChange(null)}
                className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          )}
          {(searchQuery || selectedCategory) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs h-6 px-2"
            >
              Limpiar todo
            </Button>
          )}
        </div>
      )}
    </div>
  )
}