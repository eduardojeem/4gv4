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
    return <Card className="gap-0 py-0">
      <details className="group">
        <summary className="cursor-pointer rounded-xl p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <span className="ml-2 inline-flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" />{title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
        </summary>
        <CardContent className="border-t p-4">{children}</CardContent>
      </details>
    </Card>
  }
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-6 sm:p-8 sm:pt-8">{children}</CardContent>
    </Card>
  )
}
