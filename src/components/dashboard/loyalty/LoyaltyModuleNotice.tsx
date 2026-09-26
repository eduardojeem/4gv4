'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Database, Copy, Check } from 'lucide-react'

const MIGRATIONS = [
  'supabase/migrations/20260827090000_create_loyalty_and_raffles.sql',
  'supabase/migrations/20260827090100_loyalty_and_raffles_operations.sql',
]

/**
 * Se muestra cuando las tablas todavía no existen.
 *
 * Sin esto la sección diría "Error al cargar" y nadie sabría que lo único que
 * falta es correr dos archivos SQL.
 */
export function LoyaltyModuleNotice({ message }: { message?: string | null }) {
  const [copied, setCopied] = useState(false)

  const command = `supabase db push`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin portapapeles disponible el usuario puede copiarlo a mano.
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-6 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Falta instalar el módulo de puntos y sorteos
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {message ?? 'Las tablas todavía no existen en la base de datos.'} Todo el código ya está en el
              proyecto: solo hay que aplicar las migraciones.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Archivos a aplicar
            </p>
            <ul className="space-y-1">
              {MIGRATIONS.map((file) => (
                <li key={file} className="font-mono text-[11px] break-all text-amber-900 dark:text-amber-200">
                  {file}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-amber-100 px-2.5 py-1.5 font-mono text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {command}
            </code>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={copy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
