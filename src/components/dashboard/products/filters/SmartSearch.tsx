import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  X, 
  Clock, 
  TrendingUp, 
  Filter,
  Sparkles
} from 'lucide-react';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'product' | 'category' | 'brand' | 'sku';
  count?: number;
}

interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  results: number;
}

interface SmartSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (query: string) => void;
  suggestions?: SearchSuggestion[];
  recentSearches?: SearchHistory[];
  popularSearches?: string[];
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

const SmartSearch: React.FC<SmartSearchProps> = ({
  value,
  onChange,
  onSearch,
  suggestions = [],
  recentSearches = [],
  popularSearches = [],
  isLoading = false,
  placeholder = "Buscar productos, categorías, SKU...",
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on current input
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.text.toLowerCase().includes(value.toLowerCase())
  ).slice(0, 8);

  // Combine all search options
  const allOptions = [
    ...filteredSuggestions.map(s => ({ ...s, source: 'suggestion' as const })),
    ...(value.length === 0 ? recentSearches.slice(0, 5).map(r => ({
      id: r.id,
      text: r.query,
      type: 'recent' as const,
      source: 'recent' as const,
      timestamp: r.timestamp,
      results: r.results
    })) : []),
    ...(value.length === 0 ? popularSearches.slice(0, 3).map((search, index) => ({
      id: `popular-${index}`,
      text: search,
      type: 'popular' as const,
      source: 'popular' as const
    })) : [])
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < allOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allOptions[selectedIndex]) {
          handleSelectOption(allOptions[selectedIndex].text);
        } else if (value.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectOption = (text: string) => {
    onChange(text);
    setIsOpen(false);
    setSelectedIndex(-1);
    onSearch?.(text);
  };

  const handleSearch = () => {
    if (value.trim()) {
      onSearch?.(value.trim());
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'recent': return <Clock className="h-3 w-3" />;
      case 'popular': return <TrendingUp className="h-3 w-3" />;
      case 'category': return <Filter className="h-3 w-3" />;
      default: return <Search className="h-3 w-3" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'product': return <Badge variant="outline" className="text-xs">Producto</Badge>;
      case 'category': return <Badge variant="secondary" className="text-xs">Categoría</Badge>;
      case 'brand': return <Badge variant="outline" className="text-xs">Marca</Badge>;
      case 'sku': return <Badge variant="outline" className="text-xs">SKU</Badge>;
      default: return null;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 pr-20"
        />
        
        <div className="absolute right-2 top-1.5 flex items-center gap-1">
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSearch}
            disabled={!value.trim() || isLoading}
            className="h-7 px-2"
          >
            {isLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Search className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Search Dropdown */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-auto">
          <CardContent className="p-0">
            {allOptions.length > 0 ? (
              <div className="py-2">
                {/* Smart Suggestions */}
                {filteredSuggestions.length > 0 && (
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                      <Sparkles className="h-3 w-3" />
                      Sugerencias inteligentes
                    </div>
                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id}
                        className={`flex items-center justify-between px-2 py-2 rounded cursor-pointer ${
                          selectedIndex === index ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectOption(suggestion.text)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getTypeIcon(suggestion.type)}
                          <span className="truncate">{suggestion.text}</span>
                          {getTypeBadge(suggestion.type)}
                        </div>
                        {suggestion.count && (
                          <span className="text-xs text-muted-foreground">
                            {suggestion.count}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Searches */}
                {value.length === 0 && recentSearches.length > 0 && (
                  <div className="px-3 py-2 border-t">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                      <Clock className="h-3 w-3" />
                      Búsquedas recientes
                    </div>
                    {recentSearches.slice(0, 5).map((search, index) => {
                      const optionIndex = filteredSuggestions.length + index;
                      return (
                        <div
                          key={search.id}
                          className={`flex items-center justify-between px-2 py-2 rounded cursor-pointer ${
                            selectedIndex === optionIndex ? 'bg-muted' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleSelectOption(search.query)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Clock className="h-3 w-3" />
                            <span className="truncate">{search.query}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {search.results} resultados
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Popular Searches */}
                {value.length === 0 && popularSearches.length > 0 && (
                  <div className="px-3 py-2 border-t">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                      <TrendingUp className="h-3 w-3" />
                      Búsquedas populares
                    </div>
                    {popularSearches.slice(0, 3).map((search, index) => {
                      const optionIndex = filteredSuggestions.length + recentSearches.length + index;
                      return (
                        <div
                          key={`popular-${index}`}
                          className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                            selectedIndex === optionIndex ? 'bg-muted' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => handleSelectOption(search)}
                        >
                          <TrendingUp className="h-3 w-3" />
                          <span className="truncate">{search}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : value.length > 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No se encontraron sugerencias para "{value}"
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Comienza a escribir para ver sugerencias
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartSearch;