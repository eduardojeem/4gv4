'use client'

import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * Confirmación para dar de baja algo de un catálogo global. Antes el botón de
 * la papelera daba de baja al instante, sin decir a cuántas empresas tocaba.
 * La baja es lógica: se puede reactivar y ninguna empresa pierde datos.
 */
export function CatalogDeactivateDialog({
  item,
  busy,
  onCancel,
  onConfirm,
}: {
  item: { name: string; consequence: string } | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={item !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Dar de baja «{item?.name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {item?.consequence} Se puede reactivar cuando quieras y ninguna empresa pierde datos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => { event.preventDefault(); onConfirm() }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Dar de baja
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Cuadro de cifras de los catálogos, igual en las tres pantallas. */
export function CatalogStats({ cells }: { cells: Array<{ label: string; value: string | number; hint?: string; warn?: boolean }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl border bg-card px-4 py-3">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{cell.label}</dt>
          <dd className={cell.warn ? 'mt-0.5 text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400' : 'mt-0.5 text-xl font-bold tabular-nums text-foreground'}>
            {cell.value}
          </dd>
          {cell.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{cell.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
