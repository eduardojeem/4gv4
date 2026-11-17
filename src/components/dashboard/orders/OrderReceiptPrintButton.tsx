'use client'

import { useState } from 'react'
import { ChevronDown, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Paper = '58mm' | '80mm' | 'A4'
const PAPERS: { value: Paper; label: string; hint: string }[] = [
  { value: '80mm', label: 'Ticket 80 mm', hint: 'Impresora térmica común' },
  { value: '58mm', label: 'Ticket 58 mm', hint: 'Impresora térmica chica' },
  { value: 'A4', label: 'Hoja A4', hint: 'Impresora de oficina o PDF' },
]
const STORAGE_KEY = 'orders:receipt-paper'

function savedPaper(): Paper {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === '58mm' || value === 'A4' ? value : '80mm'
  } catch {
    return '80mm'
  }
}

/**
 * Imprime el comprobante del pedido (el mismo que usa la app) en el formato
 * elegido. Antes «Imprimir detalle» imprimía la pantalla del panel. Para
 * guardar PDF se elige «Guardar como PDF» en el diálogo de impresión.
 */
export function OrderReceiptPrintButton({ orderId, className }: { orderId: string; className?: string }) {
  const [busy, setBusy] = useState(false)

  const print = async (paper: Paper) => {
    if (busy) return
    setBusy(true)
    try {
      try { window.localStorage.setItem(STORAGE_KEY, paper) } catch { /* solo recuerda el formato */ }
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/receipt?paper=${paper}`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({})) as { html?: string; error?: string }
      if (!response.ok || !body.html) throw new Error(body.error || 'No pudimos preparar el comprobante.')
      // Se imprime en un marco oculto: no abre pestañas ni lo bloquea el navegador.
      const frame = document.createElement('iframe')
      frame.setAttribute('aria-hidden', 'true')
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
      document.body.appendChild(frame)
      const cleanup = () => window.setTimeout(() => frame.remove(), 1000)
      frame.onload = () => {
        try {
          frame.contentWindow?.focus()
          frame.contentWindow?.print()
        } finally {
          cleanup()
        }
      }
      frame.srcdoc = body.html
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos imprimir el comprobante.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className ?? 'flex w-full gap-1'}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void print(savedPaper())}
        className="h-8 flex-1 gap-1.5 rounded-xl border-border/70 text-[11px] font-semibold hover:bg-accent"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
        Imprimir comprobante
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={busy} aria-label="Elegir formato de papel" className="h-8 rounded-xl border-border/70 px-2">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Formato de papel</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PAPERS.map((paper) => (
            <DropdownMenuItem key={paper.value} onSelect={() => void print(paper.value)} className="flex flex-col items-start gap-0">
              <span className="font-medium">{paper.label}</span>
              <span className="text-xs text-muted-foreground">{paper.hint}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
