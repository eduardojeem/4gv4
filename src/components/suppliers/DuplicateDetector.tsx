'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence  } from '../ui/motion'
import { AlertTriangle, X, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { UISupplier } from '@/lib/types/supplier-ui'

interface DuplicateMatch {
    supplier: UISupplier
    score: number
    reasons: string[]
}

interface DuplicateDetectorProps {
    newSupplier: Partial<UISupplier>
    existingSuppliers: UISupplier[]
    onIgnore: () => void
    onMerge?: (existingId: string) => void
    className?: string
}

export function DuplicateDetector({
    newSupplier,
    existingSuppliers,
    onIgnore,
    onMerge,
    className
}: DuplicateDetectorProps) {
    const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])

    useEffect(() => {
        const matches = findDuplicates(newSupplier, existingSuppliers)
        setDuplicates(matches)
    }, [newSupplier, existingSuppliers])

    if (duplicates.length === 0) return null

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={className}
            >
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-amber-100 dark:bg-amber-900/50 p-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>

                            <div className="flex-1 space-y-3">
                                <div>
                                    <h4 className="font-semibold text-amber-900 dark:text-amber-100">
                                        Posibles Duplicados Detectados
                                    </h4>
                                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                        Encontramos {duplicates.length} proveedor{duplicates.length > 1 ? 'es' : ''} similar{duplicates.length > 1 ? 'es' : ''}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {duplicates.map((match, index) => (
                                        <div
                                            key={match.supplier.id}
                                            className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/50 p-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-sm truncate">
                                                            {match.supplier.name}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {Math.round(match.score * 100)}% similar
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                                        {match.supplier.email && (
                                                            <div>{match.supplier.email}</div>
                                                        )}
                                                        {match.supplier.phone && (
                                                            <div>{match.supplier.phone}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {match.reasons.map((reason, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {reason}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>

                                                {onMerge && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => onMerge(match.supplier.id)}
                                                        className="flex-shrink-0"
                                                    >
                                                        Usar Existente
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={onIgnore}
                                        className="gap-2"
                                    >
                                        <Check className="h-4 w-4" />
                                        Continuar de Todos Modos
                                    </Button>
                                </div>
                            </div>

                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={onIgnore}
                                className="flex-shrink-0 h-6 w-6"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </AnimatePresence>
    )
}

// Helper function to find duplicates
function findDuplicates(
    newSupplier: Partial<UISupplier>,
    existingSuppliers: UISupplier[]
): DuplicateMatch[] {
    const matches: DuplicateMatch[] = []

    for (const existing of existingSuppliers) {
        const reasons: string[] = []
        let score = 0

        // Check name similarity
        if (newSupplier.name && existing.name) {
            const similarity = calculateStringSimilarity(
                newSupplier.name.toLowerCase(),
                existing.name.toLowerCase()
            )
            if (similarity > 0.7) {
                score += similarity * 0.4
                reasons.push('Nombre similar')
            }
        }

        // Check exact email match
        if (newSupplier.email && existing.email) {
            if (newSupplier.email.toLowerCase() === existing.email.toLowerCase()) {
                score += 0.3
                reasons.push('Email idéntico')
            }
        }

        // Check exact phone match
        if (newSupplier.phone && existing.phone) {
            const cleanNew = cleanPhone(newSupplier.phone)
            const cleanExisting = cleanPhone(existing.phone)
            if (cleanNew === cleanExisting) {
                score += 0.2
                reasons.push('Teléfono idéntico')
            }
        }

        // Check website similarity
        if (newSupplier.website && existing.website) {
            const cleanNew = cleanUrl(newSupplier.website)
            const cleanExisting = cleanUrl(existing.website)
            if (cleanNew === cleanExisting) {
                score += 0.1
                reasons.push('Sitio web idéntico')
            }
        }

        // If score is high enough, add to matches
        if (score > 0.5 && reasons.length > 0) {
            matches.push({
                supplier: existing,
                score,
                reasons
            })
        }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score)
}

// Calculate string similarity using Levenshtein distance
function calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const editDistance = levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }

    return matrix[str2.length][str1.length]
}

function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '')
}

function cleanUrl(url: string): string {
    return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase()
}
