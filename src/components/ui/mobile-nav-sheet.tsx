"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavCategory } from '@/config/admin-navigation'

export interface MobileNavSheetProps {
    categories: NavCategory[]
    title?: string
    description?: string
}

export function MobileNavSheet({
    categories,
    title = "Menú de Navegación",
    description = "Accede a todas las secciones"
}: MobileNavSheetProps) {
    const [open, setOpen] = React.useState(false)
    const pathname = usePathname()

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Abrir menú de navegación"
                >
                    <Menu className="h-5 w-5" />
                </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader className="text-left mb-6">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>

                <nav className="space-y-6" role="navigation">
                    {categories.map((category) => (
                        <div key={category.id} className="space-y-2">
                            {/* Category Label */}
                            <h3 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {category.label}
                            </h3>

                            {/* Category Items */}
                            <div className="space-y-1">
                                {category.items.map(({ key, label, icon: Icon, href, description }) => {
                                    const isActive = href === '/admin'
                                        ? pathname === href
                                        : pathname.startsWith(href || '')

                                    return (
                                        <Link
                                            key={key}
                                            href={href || '#'}
                                            onClick={() => setOpen(false)}
                                            className={cn(
                                                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all',
                                                'hover:bg-accent hover:text-accent-foreground',
                                                isActive
                                                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                                                    : 'text-foreground'
                                            )}
                                        >
                                            <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium">{label}</div>
                                                {description && (
                                                    <div className="text-xs opacity-80 truncate">
                                                        {description}
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight className="h-4 w-4 opacity-50" aria-hidden="true" />
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </SheetContent>
        </Sheet>
    )
}
