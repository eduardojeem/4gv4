'use client'

import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type POSMobileCartSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function POSMobileCartSheet({ open, onOpenChange, children }: POSMobileCartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[82dvh] flex-col overflow-hidden p-0">
        <SheetHeader className="border-b p-4"><SheetTitle>Carrito de compras</SheetTitle></SheetHeader>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
