'use client'

import { useRouter } from 'next/navigation'
import { LucideIcon } from 'lucide-react'

interface QuickAccessSection {
    title: string
    description: string
    icon: LucideIcon
    path: string
    color: 'blue' | 'purple' | 'green' | 'orange'
}

interface QuickAccessNavProps {
    sections: QuickAccessSection[]
}

const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/70 border border-blue-200 dark:border-blue-700',
    purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/70 border border-purple-200 dark:border-purple-700',
    green: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/70 border border-green-200 dark:border-green-700',
    orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/70 border border-orange-200 dark:border-orange-700'
}

export function QuickAccessNav({ sections }: QuickAccessNavProps) {
    const router = useRouter()

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sections.map((section) => {
                const Icon = section.icon
                return (
                    <button
                        key={section.path}
                        onClick={() => router.push(section.path)}
                        className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:shadow-md transition-all duration-200 text-left group hover:scale-[1.02] dark:border-muted/50 dark:bg-card/50 dark:hover:bg-card/80"
                    >
                        <div className={`p-2 rounded-lg ${colorClasses[section.color]}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                                {section.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {section.description}
                            </p>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}
