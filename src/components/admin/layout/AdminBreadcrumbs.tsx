'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminBreadcrumbs() {
    const pathname = usePathname()

    // Parse breadcrumbs from pathname
    const segments = pathname.split('/').filter(Boolean)

    const breadcrumbs = segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const label = segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

        return { href, label }
    })

    return (
        <nav className="hidden lg:flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            <Link
                href="/dashboard"
                className="flex items-center hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
                <Home className="h-4 w-4" />
            </Link>

            {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={crumb.href}>
                    <ChevronRight className="h-4 w-4" />
                    <Link
                        href={crumb.href}
                        className={cn(
                            'hover:text-gray-900 dark:hover:text-gray-100 transition-colors',
                            index === breadcrumbs.length - 1 && 'font-medium text-gray-900 dark:text-gray-100'
                        )}
                    >
                        {crumb.label}
                    </Link>
                </React.Fragment>
            ))}
        </nav>
    )
}
