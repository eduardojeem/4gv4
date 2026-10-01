'use client'

import { useState } from 'react'
import { Barcode, CheckCircle2, Copy, ExternalLink, ImageOff, ScanLine, Search, Store, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

type GlobalProduct = {
  id: string
  gtin: string
  name: string
  brand_name: string | null
  global_brand_id: string | null
  global_category_id: string | null
  description: string | null
  image_url: string | null
  is_active: boolean
  stores: number
}

interface BarcodeSimulatorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: GlobalProduct[]
  brandName: Map<string, string>
  categoryName: Map<string, string>
  onEditProduct?: (product: GlobalProduct) => void
}

export function BarcodeSimulatorDialog({
  open,
  onOpenChange,
  products,
  brandName,
  categoryName,
  onEditProduct,
}: BarcodeSimulatorDialogProps) {
  const [code, setCode] = useState('')
  const cleanCode = code.trim().replace(/\D/g, '')

  const matchedProduct = cleanCode
    ? products.find((p) => p.gtin === cleanCode || p.gtin.replace(/^0+/, '') === cleanCode.replace(/^0+/, ''))
    : null

  const isStandardLength = [8, 12, 13, 14].includes(cleanCode.length)

  const copyCode = (val: string) => {
    navigator.clipboard.writeText(val)
    toast.success(`Código ${val} copiado al portapapeles`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl border-border shadow-2xl">
        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-primary p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <ScanLine className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">Simulador de Escaneo de Códigos</DialogTitle>
              <DialogDescription className="text-xs text-white/80 mt-0.5">
                Comprobá en tiempo real qué información recibe una tienda al escanear un producto con su lector o cámara.
              </DialogDescription>
            </div>
          </div>

          <div className="mt-5 relative">
            <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ingresá o escaneá un código (ej: 7891000315507)..."
              className="h-12 pl-11 pr-24 bg-white/10 text-white placeholder:text-white/60 border-white/20 focus-visible:ring-white/40 font-mono text-base tracking-wider rounded-xl backdrop-blur-sm"
              autoFocus
            />
            {code && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCode('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 text-xs text-white/80 hover:text-white hover:bg-white/20 rounded-lg px-2"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {!cleanCode ? (
            <div className="text-center py-8 text-muted-foreground">
              <ScanLine className="h-10 w-10 mx-auto stroke-[1.5] text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Esperando código de barras...</p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs mx-auto">
                Podés escribir los números o usar tu lector USB/Bluetooth.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 text-xs">
                <span className="text-muted-foreground">Formato detectado:</span>
                <span className="font-mono font-medium">
                  {isStandardLength ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3" /> GTIN-{cleanCode.length} Válido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                      {cleanCode.length} dígitos (No estándar EAN/GTIN)
                    </Badge>
                  )}
                </span>
              </div>

              {matchedProduct ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    ¡Ficha encontrada en el Catálogo Global!
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-white border p-1 shadow-xs flex items-center justify-center overflow-hidden">
                      {matchedProduct.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={matchedProduct.image_url}
                          alt={matchedProduct.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="font-bold text-foreground text-base leading-tight">
                        {matchedProduct.name}
                      </h4>
                      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                          {matchedProduct.gtin}
                        </span>
                        <span>•</span>
                        <span>
                          {matchedProduct.global_brand_id
                            ? brandName.get(matchedProduct.global_brand_id)
                            : matchedProduct.brand_name || 'Sin marca'}
                        </span>
                        <span>•</span>
                        <span>
                          {matchedProduct.global_category_id
                            ? categoryName.get(matchedProduct.global_category_id)
                            : 'Sin categoría'}
                        </span>
                      </p>

                      <div className="pt-1 flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Store className="h-3 w-3" />
                          {matchedProduct.stores > 0
                            ? `Adoptado por ${matchedProduct.stores} tienda${matchedProduct.stores === 1 ? '' : 's'}`
                            : 'Aún no adoptado por tiendas'}
                        </Badge>
                        <Badge
                          variant={matchedProduct.is_active ? 'default' : 'destructive'}
                          className="text-[10px]"
                        >
                          {matchedProduct.is_active ? 'Activo para autocompletar' : 'De baja (no ofrecido)'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {matchedProduct.description && (
                    <div className="text-xs text-muted-foreground bg-background/80 p-2.5 rounded-xl border">
                      <span className="font-semibold text-foreground">Descripción auto-completada: </span>
                      {matchedProduct.description}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1 border-t border-emerald-500/20">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyCode(matchedProduct.gtin)}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar GTIN
                    </Button>
                    {onEditProduct && (
                      <Button
                        size="sm"
                        onClick={() => {
                          onOpenChange(false)
                          onEditProduct(matchedProduct)
                        }}
                        className="text-xs h-8 gap-1.5"
                      >
                        Editar Ficha Global
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3 bg-muted/20">
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                    <XCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">No existe en el Catálogo Global</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      El código <span className="font-mono font-semibold">{cleanCode}</span> no tiene ficha oficial todavía.
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted/60 p-2 rounded-lg max-w-md mx-auto">
                    💡 Cuando una tienda escanea este código por primera vez, el sistema sugerirá este código como candidato para sumarlo al catálogo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
