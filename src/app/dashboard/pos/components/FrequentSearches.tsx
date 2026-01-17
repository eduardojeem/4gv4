'use client'

import { Clock, TrendingUp, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SearchEntry } from '../lib/search-history'

interface FrequentSearchesProps {
  recentSearches: SearchEntry[]
  frequentSearches: SearchEntry[]
  onSearchClick?: (query: string) => void
  className?: string
}

export function FrequentSearches({
  recentSearches,
  frequentSearches,
  onSearchClick,
  className
}: FrequentSearchesProps) {
  const hasSearches = recentSearches.length > 0 || frequentSearches.length > 0

  if (!hasSearches) return null

  return (
    <div className={className}>
      {recentSearches.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-600" />
              Búsquedas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recentSearches.slice(0, 8).map((search, index) => (
                <Button
                  key={`${search.query}-${index}`}
                  variant="outline"
                  size="sm"
                  onClick={() => onSearchClick?.(search.query)}
                  className="text-xs"
                >
                  <Search className="h-3 w-3 mr-1" />
                  {search.query}
                  {search.results_count > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {search.results_count}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {frequentSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Búsquedas Frecuentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {frequentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={`${search.query}-${index}`}
                  onClick={() => onSearchClick?.(search.query)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {search.query}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {search.count}x
                    </Badge>
                    {search.results_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {search.results_count} resultados
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
