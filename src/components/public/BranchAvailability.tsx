import { MapPin, Check, XCircle, Phone } from 'lucide-react'
import type { BranchStockInfo } from '@/lib/api/products-server'

interface BranchAvailabilityProps {
  branches: BranchStockInfo[]
}

export function BranchAvailability({ branches }: BranchAvailabilityProps) {
  if (branches.length === 0) return null

  // If only one branch exists, don't show the section (single-store mode)
  if (branches.length === 1 && branches[0].isAvailable) return null

  const availableCount = branches.filter(b => b.isAvailable).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Disponibilidad por sucursal
        </h3>
      </div>

      {availableCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este producto no está disponible en ninguna sucursal actualmente.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Disponible en {availableCount} {availableCount === 1 ? 'sucursal' : 'sucursales'}
        </p>
      )}

      <div className="grid gap-2">
        {branches.map((branch) => (
          <div
            key={branch.branchId}
            className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
              branch.isAvailable
                ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                : 'border-border/50 bg-muted/20 opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                branch.isAvailable
                  ? 'bg-emerald-100 dark:bg-emerald-900/40'
                  : 'bg-muted'
              }`}>
                {branch.isAvailable ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{branch.branchName}</p>
                {branch.city && (
                  <p className="text-xs text-muted-foreground">{branch.city}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {branch.isAvailable ? (
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {branch.stockQuantity} {branch.stockQuantity === 1 ? 'unidad' : 'unidades'}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Agotado</span>
              )}
              {branch.phone && branch.isAvailable && (
                <a
                  href={`tel:${branch.phone.replace(/\D/g, '')}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/30"
                  title={`Llamar a ${branch.branchName}`}
                  aria-label={`Llamar a sucursal ${branch.branchName}`}
                >
                  <Phone className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
