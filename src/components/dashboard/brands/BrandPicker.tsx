'use client'

/**
 * Elegir la marca de un producto, o crear una en el acto.
 *
 * Antes era una lista desplegable sin búsqueda y un botón de «+» sin texto al
 * lado. Con veinticinco marcas cargadas, buscar era bajar a mano; y como crear
 * estaba a un clic y buscar no, el catálogo terminó con «Samsung» y «SAMSUNG».
 *
 * Acá crear es lo primero que se ofrece —es lo que el usuario vino a hacer—
 * pero se escribe el nombre en el buscador, así que mientras lo escribe ya ve
 * si esa marca existe. Si el nombre coincide con una que ya tiene, no se
 * ofrece crearla: se ofrece elegirla.
 *
 * Con muchas marcas la lista cargada en pantalla deja de ser confiable (ver
 * `searchBrandsOnServer`), así que a partir de cierto tamaño lo escrito se
 * busca contra la base. Mientras esa respuesta no llegue no se ofrece crear:
 * ofrecerlo sería invitar a duplicar una marca que quizá ya existe.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, Plus, Search, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { filterBrands, findExistingBrand, normalizeBrandName } from '@/lib/brands/match'
import { searchBrandsOnServer } from '@/lib/brands/search'

export type PickerBrand = { id: string; name: string }

/**
 * Hasta acá la lista que ya está en pantalla alcanza y la búsqueda es
 * instantánea. Pasado este tamaño no se puede dar por completa, así que se
 * consulta al servidor. Hoy la organización más grande tiene 29 marcas.
 */
export const MARCAS_PARA_BUSCAR_EN_SERVIDOR = 100

/** Cuántas se listan sin escribir nada, cuando hay muchas. */
export const MARCAS_VISIBLES_SIN_BUSCAR = 50

export interface BrandPickerProps {
  brands: PickerBrand[]
  /** El id de la marca elegida, o vacío. */
  value?: string | null
  onSelect: (brand: PickerBrand | null) => void
  /** Abre el alta de marca con el nombre ya escrito. */
  onCreate: (name: string) => void
  disabled?: boolean
  className?: string
  id?: string
  /** Se inyecta en los tests; en la app consulta `/api/brands`. */
  searchBrands?: (query: string, signal?: AbortSignal) => Promise<PickerBrand[]>
  /** Cuántas marcas hay en total, si se sabe. Por defecto, las cargadas. */
  totalBrands?: number
}

export function BrandPicker({
  brands,
  value,
  onSelect,
  onCreate,
  disabled,
  className,
  id,
  searchBrands = searchBrandsOnServer,
  totalBrands,
}: BrandPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [remotas, setRemotas] = useState<PickerBrand[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [falloLaBusqueda, setFalloLaBusqueda] = useState(false)

  const total = totalBrands ?? brands.length
  const sonMuchas = total >= MARCAS_PARA_BUSCAR_EN_SERVIDOR
  const escrito = query.trim()

  const elegida = useMemo(
    () => brands.find((marca) => marca.id === value) ?? null,
    [brands, value],
  )

  // Con muchas marcas lo escrito se consulta contra la base. La respuesta vieja
  // se descarta con el `AbortController`: si no, la de «sam» podía pisar a la
  // de «samsung» y decir que no existe algo que sí está.
  useEffect(() => {
    if (!open || !sonMuchas || !escrito) return

    const control = new AbortController()
    const espera = window.setTimeout(() => {
      void (async () => {
        setBuscando(true)
        setFalloLaBusqueda(false)
        try {
          const encontradas = await searchBrands(escrito, control.signal)
          if (!control.signal.aborted) setRemotas(encontradas)
        } catch (error) {
          if (control.signal.aborted || (error as Error)?.name === 'AbortError') return
          // Sin respuesta del servidor se sigue con lo que hay cargado, pero se
          // dice, porque el aviso de «ya existe» deja de ser confiable.
          setRemotas(null)
          setFalloLaBusqueda(true)
        } finally {
          if (!control.signal.aborted) setBuscando(false)
        }
      })()
    }, 250)

    return () => {
      control.abort()
      window.clearTimeout(espera)
    }
  }, [open, sonMuchas, escrito, searchBrands])

  // Con pocas marcas, o mientras no haya respuesta, manda lo que está cargado.
  const usaElServidor = sonMuchas && Boolean(escrito) && remotas !== null
  const universo = usaElServidor ? (remotas as PickerBrand[]) : brands

  const coincidencias = useMemo(() => {
    const filtradas = usaElServidor ? universo : filterBrands(universo, query)
    if (!escrito && sonMuchas) return filtradas.slice(0, MARCAS_VISIBLES_SIN_BUSCAR)
    return filtradas
  }, [usaElServidor, universo, query, escrito, sonMuchas])

  const yaExiste = useMemo(() => findExistingBrand(universo, query), [universo, query])

  // Mientras se está preguntando al servidor no se ofrece crear: podría existir.
  const puedeCrear = !yaExiste && !(sonMuchas && Boolean(escrito) && (buscando || remotas === null))

  // Abrir limpia lo escrito. El foco va al buscador con `autoFocus`, para que
  // la búsqueda sea lo primero que recibe lo que se teclea.
  const abrir = (abierto: boolean) => {
    if (abierto) {
      setQuery('')
      setRemotas(null)
      setFalloLaBusqueda(false)
    }
    setOpen(abierto)
  }

  const elegir = (marca: PickerBrand | null) => {
    onSelect(marca)
    setOpen(false)
  }

  const crear = () => {
    setOpen(false)
    onCreate(escrito)
  }

  return (
    <Popover open={open} onOpenChange={abrir} modal={true}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !elegida && 'text-muted-foreground', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Tag className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
            <span className="truncate">{elegida ? elegida.name : 'Buscar o crear una marca'}</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[calc(100vw-2rem)] p-0 z-50 shadow-lg"
        align="start"
        collisionPadding={16}
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          // En dispositivos táctiles (móviles/tablets), evitamos abrir automáticamente el teclado
          // virtual para que no tape las opciones ni rompa el scroll táctil de la lista.
          const esTactil =
            typeof window !== 'undefined' &&
            (window.matchMedia?.('(pointer: coarse)')?.matches ||
              'ontouchstart' in window ||
              navigator.maxTouchPoints > 0)
          if (esTactil) {
            e.preventDefault()
          }
        }}
      >
        {/* `shouldFilter` apagado: el orden lo decide `filterBrands`, y crear
            tiene que seguir a la vista aunque nada coincida. */}
        <Command shouldFilter={false} className="touch-pan-y">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                total > 0
                  ? `Escribí el nombre — buscá entre tus ${total} marcas`
                  : 'Escribí el nombre de la marca'
              }
              aria-label="Buscar una marca o escribir el nombre de una nueva"
              autoComplete="off"
              className="h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
          </div>

          <CommandList className="max-h-60 sm:max-h-72 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
            {/* Crear primero: es a lo que se viene. Salvo que ya exista, o que
                todavía se esté preguntando si existe. */}
            {puedeCrear && (
              <CommandGroup>
                <CommandItem
                  value="__crear__"
                  onSelect={crear}
                  className="gap-2 font-semibold text-primary data-[selected=true]:bg-primary/10"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {escrito ? <span className="truncate">Crear la marca «{escrito}»</span> : <span>Crear una marca nueva</span>}
                </CommandItem>
              </CommandGroup>
            )}

            {!puedeCrear && !yaExiste && (
              <p className="flex items-center gap-2 px-3 pt-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Fijándonos si «{escrito}» ya existe…
              </p>
            )}

            {yaExiste && (
              <p className="px-3 pt-3 text-xs text-amber-700 dark:text-amber-400">
                Ya tenés «{yaExiste.name}». Elegila de la lista en vez de crearla de nuevo.
              </p>
            )}

            {falloLaBusqueda && (
              <p className="px-3 pt-2 text-xs text-amber-700 dark:text-amber-400">
                No pudimos buscar en el servidor: abajo están solo las marcas que ya
                estaban cargadas en esta pantalla.
              </p>
            )}

            {coincidencias.length > 0 ? (
              <CommandGroup
                heading={
                  escrito
                    ? 'Tus marcas que coinciden'
                    : sonMuchas && total > coincidencias.length
                      ? `Tus marcas (${coincidencias.length} de ${total}) — escribí para buscar el resto`
                      : `Tus marcas (${total})`
                }
              >
                {coincidencias.map((marca) => (
                  <CommandItem
                    key={marca.id}
                    value={marca.id}
                    onSelect={() => elegir(marca)}
                    className="gap-2"
                  >
                    <Check
                      className={cn('h-4 w-4', marca.id === value ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    <span className="truncate">{marca.name}</span>
                    {normalizeBrandName(marca.name) === normalizeBrandName(escrito) && (
                      <span className="ml-auto text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        ya existe
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                {buscando
                  ? 'Buscando…'
                  : escrito
                    ? `Ninguna de tus marcas coincide con «${escrito}».`
                    : 'Todavía no tenés marcas cargadas.'}
              </p>
            )}

            {elegida && (
              <CommandGroup>
                <CommandItem value="__sin_marca__" onSelect={() => elegir(null)} className="gap-2 text-muted-foreground">
                  <span className="h-4 w-4" aria-hidden="true" />
                  Dejar el producto sin marca
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
