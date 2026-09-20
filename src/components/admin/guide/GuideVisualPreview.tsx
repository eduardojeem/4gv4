'use client'

import { useState } from 'react'
import {
  Barcode,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  Maximize2,
  MessageSquare,
  Package,
  QrCode,
  Receipt,
  Scan,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wrench,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { GuideImage, GuideUIPreviewType } from '@/lib/guide/types'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import { getVerticalMockupData } from '@/lib/guide/vertical-mockups'

export function GuideVisualPreview({
  preview,
  image,
  title,
  vertical,
}: {
  preview?: GuideUIPreviewType
  image?: GuideImage
  title?: string
  vertical?: BusinessVertical | string
}) {
  const [zoomOpen, setZoomOpen] = useState(false)
  const data = getVerticalMockupData(vertical)

  if (!preview && !image) return null

  return (
    <div className="my-3 overflow-hidden rounded-xl border-2 border-border/80 bg-muted/20 shadow-xs">
      {/* ── 1. Imagen Real / Captura con Visor Zoom ── */}
      {image && (
        <div className="group relative overflow-hidden bg-muted/40">
          <div className="relative aspect-video w-full cursor-zoom-in overflow-hidden" onClick={() => setZoomOpen(true)}>
            <img
              src={image.src}
              alt={image.alt || title || 'Ejemplo visual'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/75 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-xs">
                <Maximize2 className="h-3.5 w-3.5" />
                Ampliar captura
              </span>
            </div>
          </div>
          {image.caption && (
            <p className="border-t border-border/60 bg-card/90 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
              📸 {image.caption}
            </p>
          )}

          {/* Modal de Zoom */}
          {zoomOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setZoomOpen(false)}
            >
              <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-card p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setZoomOpen(false)}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                >
                  <X className="h-4 w-4" />
                </button>
                <img
                  src={image.src}
                  alt={image.alt || 'Captura ampliada'}
                  className="max-h-[82vh] w-auto rounded-xl object-contain"
                />
                {image.caption && (
                  <p className="mt-2 text-center text-xs font-medium text-muted-foreground">
                    {image.caption}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Mockups Visuales Adaptados por Rubro ── */}
      {preview === 'pos' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          {/* Header de ventana POS */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <ShoppingBag className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Terminal Punto de Venta (POS)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>Rubro: {data.verticalLabel}</span>
              </span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Caja Activa</span>
              </div>
            </div>
          </div>

          {/* Barra de escáner simulada */}
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-muted-foreground">
            <Scan className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] truncate">{data.pos.scanPlaceholder}</span>
          </div>

          {/* Ticket / Items cargados */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2 text-foreground">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{data.pos.item1.name}</p>
                <p className="text-[10px] text-muted-foreground">{data.pos.item1.detail}</p>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-300">{data.pos.item1.price}</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2 text-foreground">
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{data.pos.item2.name}</p>
                <p className="text-[10px] text-muted-foreground">{data.pos.item2.detail}</p>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-300">{data.pos.item2.price}</span>
            </div>
          </div>

          {/* Totales y métodos de pago */}
          <div className="mt-3 rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/40">
            <div className="flex items-center justify-between font-bold text-foreground text-sm">
              <span>Total a Cobrar:</span>
              <span className="text-base text-blue-700 dark:text-blue-300 font-extrabold">{data.pos.total}</span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px] font-bold">
              <span className="flex items-center justify-center gap-1 rounded-lg border border-border bg-card py-1.5 text-foreground shadow-2xs">
                💵 Efectivo
              </span>
              <span className="flex items-center justify-center gap-1 rounded-lg border border-border bg-card py-1.5 text-foreground shadow-2xs">
                📱 QR / Banco
              </span>
              <span className="flex items-center justify-center gap-1 rounded-lg border border-border bg-card py-1.5 text-foreground shadow-2xs">
                💳 Tarjeta
              </span>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: cobro ágil en mostrador con cálculo automático de vuelto y ticket.
          </p>
        </div>
      )}

      {preview === 'caja' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CreditCard className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Control Diario de Caja (Arqueo)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                Turno en Curso
              </Badge>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-foreground">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[10px] text-muted-foreground">Fondo Inicial:</span>
              <p className="text-sm font-bold text-foreground">{data.caja.openingFund}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[10px] text-muted-foreground">Ventas Efectivo:</span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{data.caja.cashSales}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[10px] text-muted-foreground">Cobros QR / Banco:</span>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{data.caja.qrSales}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
              <span className="text-[10px] text-muted-foreground">Gastos de Caja:</span>
              <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{data.caja.expenses}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border-2 border-emerald-300/80 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-950/40">
            <div>
              <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">
                Efectivo Físico Esperado:
              </span>
              <p className="text-base font-extrabold text-emerald-950 dark:text-emerald-100">{data.caja.physicalCash}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs">
              <Lock className="h-3 w-3" /> Arqueo Ciego
            </span>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica: Arqueo sin diferencias entre el sistema y el dinero físico en el cajón.
          </p>
        </div>
      )}

      {preview === 'inventory' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Package className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Ficha de Stock & Código de Barras</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-3 w-3" /> {data.inventory.stock}
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border/80 bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{data.inventory.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  SKU: {data.inventory.sku} • EAN: {data.inventory.barcode}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-mono font-bold shadow-2xs">
                <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{data.inventory.barcode}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-2.5 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground">Costo</span>
                <p className="font-bold text-foreground">{data.inventory.cost}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Venta Mostrador</span>
                <p className="font-bold text-blue-700 dark:text-blue-300">{data.inventory.price}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Margen</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">{data.inventory.margin}</p>
              </div>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: control de precios con margen y etiquetas listas para escanear.
          </p>
        </div>
      )}

      {preview === 'users' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Control de Permisos de Colaborador</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Rol: {data.users.role}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/80 bg-muted/20 p-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 font-bold text-white text-xs shadow-2xs">
              {data.users.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground">{data.users.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{data.users.email} • Sucursal Central</p>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-[11px]">
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-300/70 bg-emerald-50/50 p-1.5 font-medium text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Check className="h-3.5 w-3.5 text-emerald-600" /> {data.users.allowed1}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-emerald-300/70 bg-emerald-50/50 p-1.5 font-medium text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Check className="h-3.5 w-3.5 text-emerald-600" /> {data.users.allowed2}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-rose-300/70 bg-rose-50/50 p-1.5 font-medium text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <Lock className="h-3.5 w-3.5 text-rose-600" /> {data.users.blocked1}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-rose-300/70 bg-rose-50/50 p-1.5 font-medium text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <Lock className="h-3.5 w-3.5 text-rose-600" /> {data.users.blocked2}
            </span>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: delegá tareas operativas resguardando los costos y balances confidenciales.
          </p>
        </div>
      )}

      {preview === 'website' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Store className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Catálogo en Línea y Tienda Pública</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                En Línea 🌐
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border/80 bg-gradient-to-r from-emerald-500/10 via-card to-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">{data.website.storeName}</p>
                <p className="text-[10px] text-muted-foreground">{data.website.domain}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs">
                WhatsApp Directo 💬
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.website.categories.map((cat, i) => (
                <div key={i} className="rounded-lg border border-border/70 bg-card p-2 text-center">
                  <span className="text-lg">{cat.icon}</span>
                  <p className="font-bold text-foreground truncate mt-1">{cat.name}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">{cat.count}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: tus clientes ven tus productos disponibles y te escriben directo por WhatsApp.
          </p>
        </div>
      )}

      {preview === 'business' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                <Store className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Identidad y Datos del Negocio</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                Listo para Imprimir 📄
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <p className="text-sm font-bold text-foreground">{data.business.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  RUC: {data.business.ruc} • {data.business.city}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Check className="h-3 w-3" /> WhatsApp Vinculado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="rounded-lg border border-border/70 bg-card p-2">
                <span className="text-[10px] text-muted-foreground font-semibold">En Tickets de Cobro:</span>
                <p className="font-medium text-foreground">{data.business.ticketHeader}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-2">
                <span className="text-[10px] text-muted-foreground font-semibold">En la Tienda Web:</span>
                <p className="font-medium text-foreground">{data.business.webFeature}</p>
              </div>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: tus comprobantes impresos y catálogo llevan membrete profesional.
          </p>
        </div>
      )}

      {preview === 'sale' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Receipt className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Ticket de Venta Emitido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Cobro Exitoso
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/60 pb-1.5">
              <span className="font-mono">{data.sale.number}</span>
              <span>{data.sale.time}</span>
            </div>

            <div className="py-2 space-y-1 text-foreground">
              <div className="flex justify-between font-medium">
                <span>{data.sale.item1.name}</span>
                <span>{data.sale.item1.price}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{data.sale.item2.name}</span>
                <span>{data.sale.item2.price}</span>
              </div>
            </div>

            <div className="border-t border-border/70 pt-2 flex items-center justify-between font-bold text-sm">
              <span>Total Pagado:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{data.sale.total}</span>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
              <span>Método: {data.sale.method}</span>
              <span>Stock Actualizado ✅</span>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: la venta descuenta stock al instante y asienta el ingreso en el arqueo diario.
          </p>
        </div>
      )}

      {preview === 'repairs' && (
        <div className="bg-card p-3.5 sm:p-4 text-xs font-sans">
          {/* Header de ventana de Reparaciones */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Wrench className="h-3.5 w-3.5" />
              </span>
              <span className="font-bold text-foreground">Orden de Reparación & Taller ({data.repairs.orderNumber})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                <span>{data.verticalIcon}</span>
                <span>{data.verticalLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                <CheckCircle2 className="h-3 w-3 text-cyan-600" /> Listo para Entrega
              </span>
            </div>
          </div>

          {/* Stepper visual del flujo completo de 5 fases */}
          <div className="mt-3 rounded-xl border border-border/80 bg-muted/20 p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Flujo completo de la orden:
            </span>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5 text-[10px] text-center font-semibold">
              <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/70 p-1.5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="block font-bold">1. Ingreso ✅</span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-300">Ticket QR impreso</span>
              </div>
              <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/70 p-1.5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="block font-bold">2. Diagnóstico ✅</span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-300">Aprobado WhatsApp</span>
              </div>
              <div className="rounded-lg border border-emerald-300/80 bg-emerald-50/70 p-1.5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="block font-bold">3. Taller ✅</span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-300">Repuestos aplicados</span>
              </div>
              <div className="rounded-lg border-2 border-cyan-500 bg-cyan-50/90 p-1.5 text-cyan-950 dark:border-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200 ring-1 ring-cyan-400">
                <span className="block font-bold">4. Listo 🟢</span>
                <span className="text-[9px] text-cyan-700 dark:text-cyan-300">Cliente notificado</span>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-lg border border-border/80 bg-card p-1.5 text-muted-foreground">
                <span className="block font-bold">5. Entrega</span>
                <span className="text-[9px]">Cobro & Garantía</span>
              </div>
            </div>
          </div>

          {/* Ficha del equipo y falla */}
          <div className="mt-2.5 rounded-xl border border-border/80 bg-card p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/60 pb-2">
              <div>
                <p className="text-sm font-bold text-foreground">{data.repairs.device}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{data.repairs.serial}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Asignado a:</span>
                <span>{data.repairs.technician}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-muted-foreground">Falla declarada al ingresar:</span>
              <p className="text-xs text-foreground mt-0.5">{data.repairs.defect}</p>
            </div>

            {/* Repuestos utilizados y mano de obra */}
            <div className="border-t border-border/60 pt-2 space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground">Desglose de presupuesto:</span>
              {data.repairs.parts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-blue-600" />
                    <span>{p.name} <strong className="text-[10px] text-emerald-600 font-semibold">(Descontado de stock)</strong></span>
                  </span>
                  <span className="font-semibold text-foreground">{p.cost}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-amber-600" />
                  <span>Mano de obra y calibración técnica</span>
                </span>
                <span className="font-semibold text-foreground">{data.repairs.labor}</span>
              </div>

              <div className="flex items-center justify-between border-t border-border/70 pt-2 text-sm font-bold">
                <span>Total a Cobrar al Retirar:</span>
                <span className="text-base text-cyan-700 dark:text-cyan-300 font-extrabold">{data.repairs.total}</span>
              </div>
            </div>

            {/* Certificado de garantía */}
            <div className="rounded-lg border border-cyan-300/80 bg-cyan-50/60 p-2 text-[10px] font-medium text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">
              <span className="font-bold">🛡️ Cobertura post-servicio: </span>
              <span>{data.repairs.warranty}</span>
            </div>
          </div>

          {/* Botones de acción rápida simulados */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-foreground shadow-2xs">
                <QrCode className="h-3 w-3 text-primary" /> Ver Ticket QR
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900 shadow-2xs dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                <MessageSquare className="h-3 w-3 text-emerald-600" /> Avisado por WhatsApp
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-xs">
              <Receipt className="h-3 w-3" /> Cobrar en POS y Entregar
            </span>
          </div>

          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            💡 Simulación didáctica de {data.verticalLabel}: trazabilidad total desde que el cliente entrega el equipo hasta que retira con su garantía.
          </p>
        </div>
      )}
    </div>
  )
}
