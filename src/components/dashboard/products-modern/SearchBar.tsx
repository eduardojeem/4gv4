/**
 * SearchBar Component
 * Search input with icon and debounced filtering
 */

import React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const SearchBar = React.memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar por nombre, SKU o marca...',
  className
}: SearchBarProps) {
  return (
    <div className={cn('relative flex-1', className)}>
      <label htmlFor="product-search" className="sr-only">
        Buscar productos
      </label>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      <Input
        id="product-search"
        type="search"
        role="searchbox"
        aria-label="Buscar productos por nombre, SKU o marca"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 h-11 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-900"
      />
    </div>
  )
})
