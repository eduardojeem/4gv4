'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface FormLayoutProps {
    title?: string
    description?: string
    onSubmit: (e: React.FormEvent) => void
    onCancel?: () => void
    loading?: boolean
    submitLabel?: string
    cancelLabel?: string
    children: ReactNode
    actions?: ReactNode
    className?: string
}

// ============================================================================
// Main Component
// ============================================================================

export function FormLayout({
    title,
    description,
    onSubmit,
    onCancel,
    loading = false,
    submitLabel = 'Guardar',
    cancelLabel = 'Cancelar',
    children,
    actions,
    className
}: FormLayoutProps) {

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!loading) {
            onSubmit(e)
        }
    }

    return (
        <form onSubmit={handleSubmit} className={cn("relative", className)}>
            <Card>
                {(title || description) && (
                    <CardHeader>
                        {title && <CardTitle>{title}</CardTitle>}
                        {description && <CardDescription>{description}</CardDescription>}
                    </CardHeader>
                )}

                <CardContent className="space-y-6">
                    {children}
                </CardContent>

                <div className="border-t bg-gray-50 dark:bg-gray-800/50 px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {onCancel && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    disabled={loading}
                                >
                                    {cancelLabel}
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {actions}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="min-w-24"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    submitLabel
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <p className="text-sm text-muted-foreground">Procesando...</p>
                    </div>
                </div>
            )}
        </form>
    )
}
