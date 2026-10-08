import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

export function ResponsiveProductFilters({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const mobile = useIsMobile()
  if (mobile) return <Sheet open={open} onOpenChange={next => { if (!next) onClose() }}>
    <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl" onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('products-filters-toggle')?.focus() }}>
      <SheetHeader><SheetTitle>Filtrar productos</SheetTitle><SheetDescription>Los cambios se aplican al listado automáticamente.</SheetDescription></SheetHeader>
      <div className="min-h-0 overflow-y-auto px-4">{children}</div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button type="button" className="h-11 w-full" onClick={onClose}>Volver al listado</Button></div>
    </SheetContent>
  </Sheet>
  return open ? <Card className="rounded-2xl"><div className="p-4 sm:p-5">{children}</div></Card> : null
}
