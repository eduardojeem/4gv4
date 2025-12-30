'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// ============================================================================
// Types
// ============================================================================

export interface Action {
    label: string
    onClick: () => void
    icon?: LucideIcon
    variant?: 'default' | 'destructive'
    disabled?: boolean
}

export interface StatusBadge {
    label: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

export interface MetadataItem {
    label: string
    value: ReactNode
    icon?: LucideIcon
}

export interface EntityCardProps {
    title: string
    subtitle?: string
    description?: string
    status?: StatusBadge
    image?: string
    metadata?: MetadataItem[]
    actions?: Action[]
    variant?: 'default' | 'compact' | 'detailed'
    onClick?: () => void
    className?: string
    children?: ReactNode
}

// ============================================================================
// Main Component
// ============================================================================

export function EntityCard({
    title,
    subtitle,
    description,
    status,
    image,
    metadata,
    actions,
    variant = 'default',
    onClick,
    className,
    children
}: EntityCardProps) {

    // Actions Menu
    const ActionsMenu = actions && actions.length > 0 && (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {actions.map((action, index) => {
                    const Icon = action.icon
                    return (
                        <DropdownMenuItem
                            key={index}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={cn(
                                action.variant === 'destructive' && 'text-red-600 dark:text-red-400'
                            )}
                        >
                            {Icon && <Icon className="mr-2 h-4 w-4" />}
                            {action.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )

    // Compact Variant
    if (variant === 'compact') {
        return (
            <Card
                className={cn(
                    "hover:shadow-md transition-all duration-200",
                    onClick && "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700",
                    className
                )}
                onClick={onClick}
            >
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        {image && (
                            <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                                <Image
                                    src={image}
                                    alt={title}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm truncate">{title}</h3>
                                    {subtitle && (
                                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                                    )}
                                </div>
                                {status && (
                                    <Badge variant={status.variant} className="flex-shrink-0 text-xs">
                                        {status.label}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        {ActionsMenu}
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Detailed Variant
    if (variant === 'detailed') {
        return (
            <Card
                className={cn(
                    "hover:shadow-lg transition-all duration-300",
                    onClick && "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700",
                    className
                )}
                onClick={onClick}
            >
                {image && (
                    <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                        <Image
                            src={image}
                            alt={title}
                            fill
                            className="object-cover"
                        />
                    </div>
                )}
                <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-xl">{title}</CardTitle>
                            {subtitle && <CardDescription className="mt-1">{subtitle}</CardDescription>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {status && (
                                <Badge variant={status.variant}>
                                    {status.label}
                                </Badge>
                            )}
                            {ActionsMenu}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {description && (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    )}

                    {metadata && metadata.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {metadata.map((item, index) => {
                                const Icon = item.icon
                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                            {Icon && <Icon className="h-3 w-3" />}
                                            {item.label}
                                        </div>
                                        <div className="text-sm font-semibold">{item.value}</div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {children}
                </CardContent>
            </Card>
        )
    }

    // Default Variant
    return (
        <Card
            className={cn(
                "hover:shadow-lg transition-all duration-300",
                onClick && "cursor-pointer hover:border-blue-300 dark:hover:border-blue-700",
                className
            )}
            onClick={onClick}
        >
            <CardHeader>
                <div className="flex items-start gap-3">
                    {image && (
                        <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                            <Image
                                src={image}
                                alt={title}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg">{title}</CardTitle>
                                {subtitle && <CardDescription className="mt-1">{subtitle}</CardDescription>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {status && (
                                    <Badge variant={status.variant}>
                                        {status.label}
                                    </Badge>
                                )}
                                {ActionsMenu}
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>

            {(description || metadata || children) && (
                <CardContent className="space-y-3">
                    {description && (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    )}

                    {metadata && metadata.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {metadata.map((item, index) => {
                                const Icon = item.icon
                                return (
                                    <div key={index} className="space-y-1">
                                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                            {Icon && <Icon className="h-3 w-3" />}
                                            {item.label}
                                        </div>
                                        <div className="text-sm font-semibold">{item.value}</div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {children}
                </CardContent>
            )}
        </Card>
    )
}
