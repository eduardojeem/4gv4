'use client'

/**
 * Elegir el celular desde un menú, no desde una fila de chips.
 *
 * La franja mostraba todas las marcas y, al elegir una, todos sus modelos al
 * lado: con un taller que trabaja diez marcas la fila se volvía una tira
 * larguísima que tapaba el resto de los filtros. Un menú ocupa un botón y abre
 * la lista completa sólo cuando hace falta, con los modelos en un submenú de
 * cada marca —que es como el cliente piensa: primero Apple, después iPhone 13.
 *
 * El botón dice siempre qué está elegido, así se entiende sin abrirlo.
 */

import { Check, ChevronDown, Smartphone, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DeviceOptions } from '@/lib/products/device-options'

export interface DeviceMenuProps {
  facets: DeviceOptions
  selectedBrand: string
  selectedModel: string
  /** `celular` es la marca del teléfono; `modelo`, el modelo. */
  onSelect: (updates: { celular?: string | null; modelo?: string | null }) => void
  /** En el panel lateral el botón ocupa todo el ancho. */
  fullWidth?: boolean
}

export function DeviceMenu({ facets, selectedBrand, selectedModel, onSelect, fullWidth = false }: DeviceMenuProps) {
  if (facets.brands.length === 0) return null

  const activo = Boolean(selectedBrand || selectedModel)
  const etiqueta = activo ? [selectedBrand, selectedModel].filter(Boolean).join(' ') : 'Tu celular'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-xs font-semibold transition-all shadow-xs select-none',
            // En el telefono el nombre largo no puede comerse la franja de marcas.
            fullWidth ? 'w-full justify-between' : 'shrink-0 max-w-[55%] sm:max-w-none',
            activo
              ? 'border-primary/60 text-primary ring-1 ring-primary/20'
              : 'border-border/80 text-foreground hover:border-primary/40'
          )}
          aria-label={activo ? `Celular elegido: ${etiqueta}` : 'Elegir el celular'}
          // En el panel lateral el nombre largo se corta: el titulo lo muestra entero.
          title={activo ? etiqueta : 'Elegir el celular'}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Smartphone className={cn('h-3.5 w-3.5 shrink-0', activo ? 'text-primary' : 'text-muted-foreground')} />
            <span className="truncate">{etiqueta}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" collisionPadding={12} className="w-[min(15rem,88vw)] rounded-2xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Repuestos para tu celular
        </DropdownMenuLabel>

        <DropdownMenuItem
          onSelect={() => onSelect({ celular: null, modelo: null })}
          className={cn(
            'rounded-xl px-3 py-2 text-xs font-semibold',
            !activo && 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground'
          )}
        >
          Todos los celulares
          {!activo && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <div className="max-h-72 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {facets.brands.map((marca) => {
            const modelos = facets.modelsByBrand[marca] ?? []
            const marcaActiva = selectedBrand === marca

            // Una marca sin modelos cargados no necesita submenú: filtra sola.
            if (modelos.length === 0) {
              return (
                <DropdownMenuItem
                  key={marca}
                  onSelect={() => onSelect({ celular: marcaActiva ? null : marca, modelo: null })}
                  className={cn(
                    'rounded-xl px-3 py-2 text-xs font-semibold',
                    marcaActiva && 'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                  )}
                >
                  {marca}
                  {marcaActiva && <Check className="ml-auto h-3.5 w-3.5" />}
                </DropdownMenuItem>
              )
            }

            return (
              <DropdownMenuSub key={marca}>
                <DropdownMenuSubTrigger
                  className={cn(
                    'rounded-xl px-3 py-2 text-xs font-semibold',
                    marcaActiva && 'bg-primary/10 text-primary data-[state=open]:bg-primary/10'
                  )}
                >
                  <span className="truncate">{marca}</span>
                  <span
                    className={cn(
                      'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      marcaActiva ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {modelos.length}
                  </span>
                </DropdownMenuSubTrigger>

                <DropdownMenuPortal>
                  {/* En el telefono el submenu se salia de la pantalla: que se reacomode solo. */}
                  <DropdownMenuSubContent collisionPadding={12} className="w-[min(13rem,70vw)] rounded-2xl p-1.5">
                    <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Modelos de {marca}
                    </DropdownMenuLabel>

                    {/* Elegir sólo la marca: todos los repuestos de ese fabricante. */}
                    <DropdownMenuItem
                      onSelect={() => onSelect({ celular: marca, modelo: null })}
                      className={cn(
                        'rounded-xl px-3 py-2 text-xs font-semibold',
                        marcaActiva && !selectedModel &&
                          'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                      )}
                    >
                      Todos los {marca}
                      {marcaActiva && !selectedModel && <Check className="ml-auto h-3.5 w-3.5" />}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1" />

                    <div className="max-h-64 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                      {modelos.map((modelo) => {
                        const modeloActivo = marcaActiva && selectedModel === modelo
                        return (
                          <DropdownMenuItem
                            key={modelo}
                            // Siempre se manda la marca: elegir un modelo desde
                            // otra marca abierta tiene que cambiar las dos.
                            onSelect={() =>
                              onSelect({ celular: marca, modelo: modeloActivo ? null : modelo })
                            }
                            className={cn(
                              'rounded-xl px-3 py-2 text-xs font-semibold',
                              modeloActivo &&
                                'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground'
                            )}
                          >
                            <span className="truncate">{modelo}</span>
                            {modeloActivo && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )
          })}
        </div>

        {activo && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onSelect={() => onSelect({ celular: null, modelo: null })}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground"
            >
              <X className="mr-2 h-3.5 w-3.5" />
              Quitar el filtro de celular
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
