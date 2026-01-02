'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence  } from '../ui/motion'

interface SearchBarProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    suggestions?: string[]
    onSuggestionClick?: (suggestion: string) => void
    className?: string
    showCommandHint?: boolean
}

export function SearchBar({
    value,
    onChange,
    placeholder = "Buscar...",
    suggestions = [],
    onSuggestionClick,
    className,
    showCommandHint = true
}: SearchBarProps) {
    const [isFocused, setIsFocused] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }

        if (showCommandHint) {
            document.addEventListener('keydown', handleKeyDown)
            return () => document.removeEventListener('keydown', handleKeyDown)
        }
    }, [showCommandHint])

    const filteredSuggestions = suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5)

    const handleClear = () => {
        onChange('')
        inputRef.current?.focus()
    }

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion)
        onSuggestionClick?.(suggestion)
        setShowSuggestions(false)
    }

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            {/* Search Input */}
            <div className={cn(
                "relative flex items-center rounded-lg border-2 bg-background transition-all duration-200",
                isFocused
                    ? "border-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10"
                    : "border-border hover:border-primary/50"
            )}>
                {/* Search Icon */}
                <div className="pl-4 pr-2">
                    <Search className={cn(
                        "h-5 w-5 transition-colors duration-200",
                        isFocused ? "text-primary" : "text-muted-foreground"
                    )} />
                </div>

                {/* Input */}
                <Input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setShowSuggestions(true)
                    }}
                    onFocus={() => {
                        setIsFocused(true)
                        if (filteredSuggestions.length > 0) {
                            setShowSuggestions(true)
                        }
                    }}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className="flex-1 border-0 bg-transparent px-2 py-3 text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                />

                {/* Clear Button */}
                <AnimatePresence>
                    {value && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleClear}
                            className="mr-2 rounded-md p-1.5 hover:bg-muted transition-colors"
                            type="button"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Command Hint */}
                {showCommandHint && !isFocused && !value && (
                    <div className="mr-4 flex items-center gap-1 text-xs text-muted-foreground">
                        <Command className="h-3 w-3" />
                        <span>K</span>
                    </div>
                )}
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
                {showSuggestions && filteredSuggestions.length > 0 && value && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-2 w-full rounded-lg border bg-popover shadow-lg overflow-hidden"
                    >
                        <div className="p-2">
                            <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
                                Sugerencias
                            </p>
                            {filteredSuggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
                                >
                                    <div className="flex items-center gap-2">
                                        <Search className="h-4 w-4 text-muted-foreground" />
                                        <span>{suggestion}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
