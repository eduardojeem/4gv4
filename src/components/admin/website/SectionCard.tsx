import type { ComponentType, ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/**
 * Consistent section card for the website admin editors — an icon tile + title,
 * no rainbow gradients. Keeps every editor visually aligned with the app's
 * design system.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  collapsible = false,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  children: ReactNode
  collapsible?: boolean
}) {
  if (collapsible) {
    return (
      <Card className="gap-0 py-0 rounded-2xl overflow-hidden border-border/80 shadow-2xs">
        <details className="group">
          <summary className="cursor-pointer rounded-2xl p-3.5 sm:p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring hover:bg-muted/30 transition-colors">
            <span className="ml-1 sm:ml-2 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              {title}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground leading-relaxed pl-1 sm:pl-2">
              {description}
            </span>
          </summary>
          <CardContent className="border-t p-3.5 sm:p-5 pt-4">{children}</CardContent>
        </details>
      </Card>
    )
  }
  return (
    <Card className="rounded-2xl border-border/80 shadow-2xs overflow-hidden">
      <CardHeader className="border-b bg-muted/30 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-primary shadow-xs">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-foreground">{title}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 sm:pt-6">{children}</CardContent>
    </Card>
  )
}
