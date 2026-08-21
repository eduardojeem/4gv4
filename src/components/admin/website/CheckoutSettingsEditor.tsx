'use client'

import { useEffect, useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { useWebsiteEditorDirty } from '@/components/admin/website/website-editor-dirty'
import { CheckoutCustomerPreview } from '@/components/admin/website/CheckoutCustomerPreview'
import { SectionHowItWorks } from '@/components/admin/website/SectionHowItWorks'
import { BankTransferOptionsEditor } from '@/components/admin/website/BankTransferOptionsEditor'
import { DeliveryZoneOptionsEditor } from '@/components/admin/website/DeliveryZoneOptionsEditor'
import { CommerceModeSelector } from '@/components/admin/website/CommerceModeSelector'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { BankTransferOption, CheckoutSettings, PaymentMethodConfig } from '@/types/website-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Save,
  Store,
  Truck,
  Wallet,
  Info,
  QrCode,
  Banknote,
  CheckCircle,
  HelpCircle,
  Sparkles,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Payment method labels & icons ───────────────────────────────────────────
const PM_META = {
  cash: {
    label: 'Efectivo',
    Icon: Banknote,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    hint: 'Pago contra entrega al recibir el delivery o al retirar en mostrador.',
    placeholder: 'Ej. Aboná en efectivo al recibir tu pedido (tené a mano el monto exacto).',
  },
  card: {
    label: 'Tarjeta Débito / Crédito',
    Icon: CreditCard,
    accentColor: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    hint: 'Cobro con Posnet en el local o terminal portátil del repartidor.',
    placeholder: 'Ej. Aceptamos todas las tarjetas con Posnet al entregar o en tienda.',
  },
  transfer: {
    label: 'Transferencia Bancaria',
    Icon: CreditCard,
    accentColor: 'text-purple-600 dark:text-purple-400',
    accentBg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    hint: 'Carga tus datos bancarios (Banco, Alias, CBU y Titular) para mostrarlos al cliente.',
    placeholder: 'Ej. Realizá la transferencia y envianos el comprobante por WhatsApp con tu número de orden.',
  },
  digital_wallet: {
    label: 'Billetera Digital / Cobro QR',
    Icon: QrCode,
    accentColor: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    hint: 'Ueno, Bancard, MercadoPago, etc. Carga tu alias o sube la imagen de tu QR.',
    placeholder: 'Ej. Escaneá el código QR o transferí a nuestro alias y envianos el comprobante.',
  },
} as const

type PMKey = keyof typeof PM_META

function getTransferOptions(config: PaymentMethodConfig): BankTransferOption[] {
  if (config.transferOptions !== undefined) return config.transferOptions
  if (!config.bankName && !config.bankAlias && !config.bankCbu) return []

  return [{
    id: 'legacy-bank-option',
    bankName: config.bankName || 'Cuenta bancaria',
    alias: config.bankAlias || '',
    accountNumber: config.bankCbu || '',
    accountHolder: '',
  }]
}

// ─── Payment method card ──────────────────────────────────────────────────────
function PaymentMethodCard({
  pmKey, config, onChange,
}: {
  pmKey: PMKey
  config: PaymentMethodConfig
  onChange: (key: PMKey, val: PaymentMethodConfig) => void
}) {
  const meta = PM_META[pmKey]
  const Icon = meta.Icon
  const set = <K extends keyof PaymentMethodConfig>(field: K, val: PaymentMethodConfig[K]) => {
    onChange(pmKey, { ...config, [field]: val })
  }

  return (
    <div className={cn(
      'space-y-3.5 rounded-2xl border-2 p-4 sm:p-5 transition-all shadow-2xs',
      config.enabled ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10' : 'border-border/80 bg-muted/15 opacity-75'
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
            config.enabled ? 'bg-primary text-primary-foreground shadow-xs' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm text-foreground">{meta.label}</p>
              {config.enabled && (
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Activo
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.hint}</p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => set('enabled', v)}
          aria-label={`${config.enabled ? 'Deshabilitar' : 'Habilitar'} ${meta.label}`}
        />
      </div>

      {config.enabled && (
        <div className="space-y-3 pt-2 border-t border-border/60">
          {/* Custom label */}
          <div className="space-y-1.5">
            <Label htmlFor={`${pmKey}-label`} className="text-xs font-semibold">
              Nombre visible en el carrito
            </Label>
            <Input
              id={`${pmKey}-label`}
              value={config.label ?? ''}
              onChange={(e) => set('label', e.target.value)}
              placeholder={meta.label}
              maxLength={60}
              className="h-9 rounded-xl text-xs bg-background"
            />
          </div>

          {/* Instructions shown to customer */}
          <div className="space-y-1.5">
            <Label htmlFor={`${pmKey}-instructions`} className="text-xs font-semibold">
              Instrucciones para el cliente al pagar
            </Label>
            <Textarea
              id={`${pmKey}-instructions`}
              value={config.instructions ?? ''}
              onChange={(e) => set('instructions', e.target.value)}
              rows={2}
              maxLength={500}
              className="resize-none rounded-xl text-xs bg-background"
              placeholder={meta.placeholder}
            />
          </div>

          {/* Transfer-specific */}
          {pmKey === 'transfer' && (
            <div className="pt-2">
              <BankTransferOptionsEditor
                options={getTransferOptions(config)}
                onChange={(options) => set('transferOptions', options)}
              />
            </div>
          )}

          {/* Digital wallet-specific */}
          {pmKey === 'digital_wallet' && (
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="wallet-alias" className="text-xs font-semibold">Alias de billetera</Label>
                <Input
                  id="wallet-alias"
                  value={config.walletAlias ?? ''}
                  onChange={(e) => set('walletAlias', e.target.value)}
                  placeholder="Ej. mi.negocio.ueno o alias.mp"
                  maxLength={100}
                  className="h-9 rounded-xl text-xs bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wallet-qr-url" className="text-xs font-semibold">URL de imagen QR</Label>
                <Input
                  id="wallet-qr-url"
                  type="url"
                  value={config.qrImageUrl ?? ''}
                  onChange={(e) => set('qrImageUrl', e.target.value)}
                  placeholder="https://cdn.tu-dominio.com/qr.png"
                  maxLength={500}
                  className="h-9 rounded-xl text-xs bg-background"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export function CheckoutSettingsEditor() {
  const { settings, isLoading, isSaving, updateSetting } = useAdminWebsiteSettings()
  const defaultCheckout = getWebsiteSettingsDefaults().checkout

  const [lastSaved, setLastSaved] = useState<CheckoutSettings | null>(null)
  const [draft, setDraft] = useState<CheckoutSettings | null>(null)

  const baseline: CheckoutSettings = lastSaved ?? settings?.checkout ?? defaultCheckout
  const current: CheckoutSettings = draft ?? baseline
  const hasChanges = draft !== null
  const commerceMode = current.commerceMode ?? 'cart'
  const enabledPaymentCount = (Object.keys(PM_META) as PMKey[])
    .filter((key) => current.payment[key].enabled).length
  const hasPaymentMethod = enabledPaymentCount > 0
  const hasFulfillmentOption = current.delivery.enabled || current.pickup.enabled
  const hasValidTransferOptions = !current.payment.transfer.enabled ||
    (current.payment.transfer.transferOptions ?? []).every((option) => (
      option.bankName.trim().length >= 2 &&
      Boolean(option.alias?.trim() || option.accountNumber?.trim())
    ))
  const hasValidDeliveryZones = (current.delivery.zoneOptions ?? []).every((zone) => (
    zone.name.trim().length >= 2 &&
    zone.cost >= 0 &&
    zone.cost <= 9_999_999
  ))
  const isCheckoutReady = commerceMode !== 'cart' || (
    hasPaymentMethod &&
    hasFulfillmentOption &&
    hasValidTransferOptions &&
    hasValidDeliveryZones
  )
  const checkoutIssue = commerceMode !== 'cart'
    ? null
    : !hasPaymentMethod
    ? 'Habilita al menos un método de pago.'
    : !hasFulfillmentOption
      ? 'Habilita al menos delivery o retiro en local.'
      : !hasValidTransferOptions
        ? 'Cada cuenta bancaria necesita nombre y al menos un alias o número.'
        : !hasValidDeliveryZones
          ? 'Revisa que las zonas de delivery tengan nombre y tarifa válida.'
          : null

  const dirtyCtx = useWebsiteEditorDirty()
  useEffect(() => {
    dirtyCtx?.setDirty(hasChanges)
    return () => dirtyCtx?.setDirty(false)
  }, [hasChanges, dirtyCtx])

  function patch<K extends keyof CheckoutSettings>(key: K, val: CheckoutSettings[K]) {
    setDraft((prev) => ({ ...(prev ?? baseline), [key]: val }))
  }

  function patchPayment(pmKey: PMKey, val: PaymentMethodConfig) {
    setDraft((prev) => ({
      ...(prev ?? baseline),
      payment: { ...(prev ?? baseline).payment, [pmKey]: val },
    }))
  }

  function patchDelivery(field: string, val: unknown) {
    setDraft((prev) => ({
      ...(prev ?? baseline),
      delivery: { ...(prev ?? baseline).delivery, [field]: val },
    }))
  }

  function patchPickup(field: string, val: unknown) {
    setDraft((prev) => ({
      ...(prev ?? baseline),
      pickup: { ...(prev ?? baseline).pickup, [field]: val },
    }))
  }

  async function handleSave() {
    if (!draft) return
    if (!isCheckoutReady) {
      toast.error('El checkout todavía está incompleto', {
        description: !hasPaymentMethod
          ? 'Habilitá al menos un método de pago.'
          : !hasFulfillmentOption
            ? 'Habilitá delivery o retiro en local.'
            : !hasValidTransferOptions
              ? 'Cada cuenta necesita banco y al menos un alias o número de cuenta.'
              : 'Cada zona necesita un nombre y una tarifa válida.',
      })
      return
    }

    const savedValue = draft
    const result = await updateSetting('checkout', savedValue)
    if (result?.success === false) {
      toast.error('Error al guardar', { description: result.error })
    } else {
      toast.success('Configuración de pagos y entregas guardada correctamente')
      setLastSaved(savedValue)
      setDraft(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Selector de Modo Comercial */}
      <CommerceModeSelector
        value={commerceMode}
        onChange={(mode) => patch('commerceMode', mode)}
      />

      {/* Checklist de Preparación del Checkout */}
      <div
        id="checkout-readiness"
        role="status"
        className={cn(
          'p-5 sm:p-6 rounded-2xl border-2 transition-all space-y-4 shadow-2xs',
          isCheckoutReady
            ? 'border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-800/80 dark:bg-emerald-950/20'
            : 'border-amber-300/80 bg-amber-50/40 dark:border-amber-800/80 dark:bg-amber-950/20'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs',
              isCheckoutReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            )}>
              {isCheckoutReady ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-foreground">
                  {commerceMode === 'cart'
                    ? isCheckoutReady ? 'Checkout Listo para Recibir Pedidos' : 'Configuración de Checkout Incompleta'
                    : commerceMode === 'whatsapp'
                      ? 'Tienda Lista: Consultas por WhatsApp'
                      : 'Tienda Lista: Catálogo Informativo'}
                </h3>
                <Badge className={cn(
                  'text-[10px] font-black uppercase border-0',
                  isCheckoutReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                )}>
                  {isCheckoutReady ? 'Operativo' : 'Requiere Atención'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {commerceMode === 'cart'
                  ? isCheckoutReady
                    ? 'Tus clientes podrán armar carritos, elegir métodos de pago y seleccionar su entrega sin errores.'
                    : checkoutIssue || 'Revisa los requisitos marcados en la lista a continuación para habilitar las ventas.'
                  : commerceMode === 'whatsapp'
                    ? 'Cada producto mostrará un botón de WhatsApp directo con el precio y nombre del artículo.'
                    : 'Tus productos se mostrarán como catálogo para explorar sin botones de compra.'}
              </p>
            </div>
          </div>
        </div>

        {/* Mini Checklist Visual cuando está en modo carrito */}
        {commerceMode === 'cart' && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 pt-2 border-t border-border/60">
            <div className={cn(
              'p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold',
              hasPaymentMethod ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300'
            )}>
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasPaymentMethod ? `✓ ${enabledPaymentCount} métodos de pago` : '⚠️ Falta método de pago'}
              </span>
            </div>

            <div className={cn(
              'p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold',
              hasFulfillmentOption ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300'
            )}>
              <Truck className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasFulfillmentOption
                  ? `✓ ${[current.delivery.enabled && 'Delivery', current.pickup.enabled && 'Retiro'].filter(Boolean).join(' y ')}`
                  : '⚠️ Falta entrega o retiro'}
              </span>
            </div>

            <div className={cn(
              'p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold',
              hasValidTransferOptions ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300'
            )}>
              <Wallet className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasValidTransferOptions ? '✓ Cuentas bancarias OK' : '⚠️ Revisar cuentas'}
              </span>
            </div>

            <div className={cn(
              'p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold',
              hasValidDeliveryZones ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 text-amber-800 dark:text-amber-300'
            )}>
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasValidDeliveryZones ? '✓ Zonas de envío OK' : '⚠️ Revisar tarifas'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6">
          {commerceMode === 'cart' ? (
            <>
              {/* ── Métodos de Pago ── */}
              <Card className="rounded-2xl border bg-card shadow-2xs overflow-hidden">
                <CardHeader className="p-5 sm:p-6 pb-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2.5">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span>Métodos de Pago Aceptados</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Paso 2
                    </Badge>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Activa las opciones de cobro que ofreces. Los métodos habilitados aparecerán en la pasarela de compra.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0 space-y-3.5">
                  {(Object.keys(PM_META) as PMKey[]).map((key) => (
                    <PaymentMethodCard
                      key={key}
                      pmKey={key}
                      config={current.payment[key]}
                      onChange={patchPayment}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* ── Envío a Domicilio (Delivery) ── */}
              <Card className="rounded-2xl border bg-card shadow-2xs overflow-hidden">
                <CardHeader className="p-5 sm:p-6 pb-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2.5">
                      <Truck className="h-5 w-5 text-primary" />
                      <span>Envío a Domicilio (Delivery)</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Paso 3
                    </Badge>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Configura si ofreces reparto a domicilio, zonas de cobertura y tarifas por ciudad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border-2 p-4 bg-muted/15">
                    <div>
                      <p className="font-bold text-sm text-foreground">Habilitar Envío a Domicilio</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Si lo desactivas, los clientes solo podrán seleccionar retiro en tienda.
                      </p>
                    </div>
                    <Switch
                      checked={current.delivery.enabled}
                      onCheckedChange={(v) => patchDelivery('enabled', v)}
                      aria-label={`${current.delivery.enabled ? 'Deshabilitar' : 'Habilitar'} envío a domicilio`}
                    />
                  </div>

                  {current.delivery.enabled && (
                    <div className="space-y-4 pt-1">
                      <div className="grid gap-3.5 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="delivery-default-cost" className="text-xs font-semibold">
                            Tarifa por defecto (Gs.)
                          </Label>
                          <Input
                            id="delivery-default-cost"
                            type="number"
                            min={0}
                            step={500}
                            value={current.delivery.defaultCost || ''}
                            onChange={(e) => patchDelivery('defaultCost', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="h-10 rounded-xl text-xs bg-background"
                          />
                          <p className="text-[11px] text-muted-foreground">Para zonas sin tarifa específica.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="delivery-free-threshold" className="text-xs font-semibold">
                            Envío gratis desde (Gs.)
                          </Label>
                          <Input
                            id="delivery-free-threshold"
                            type="number"
                            min={0}
                            step={1000}
                            value={current.delivery.freeThreshold || ''}
                            onChange={(e) => patchDelivery('freeThreshold', Number(e.target.value) || 0)}
                            placeholder="0 = siempre se cobra"
                            className="h-10 rounded-xl text-xs bg-background"
                          />
                          <p className="text-[11px] text-muted-foreground">0 = siempre cobra el delivery.</p>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="delivery-estimated-time" className="text-xs font-semibold">
                            Tiempo estimado
                          </Label>
                          <Input
                            id="delivery-estimated-time"
                            value={current.delivery.estimatedTime}
                            onChange={(e) => patchDelivery('estimatedTime', e.target.value)}
                            placeholder="Ej. 30–60 min o En el día"
                            maxLength={60}
                            className="h-10 rounded-xl text-xs bg-background"
                          />
                        </div>
                      </div>

                      <DeliveryZoneOptionsEditor
                        zones={current.delivery.zoneOptions ?? []}
                        onChange={(zones) => patchDelivery('zoneOptions', zones)}
                      />

                      <div className="space-y-1.5">
                        <Label htmlFor="delivery-zones" className="text-xs font-semibold">
                          Descripción de cobertura adicional
                        </Label>
                        <Input
                          id="delivery-zones"
                          value={current.delivery.zones ?? ''}
                          onChange={(e) => patchDelivery('zones', e.target.value)}
                          placeholder="Ej. Consultá por envíos express al interior o encomiendas."
                          maxLength={300}
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="delivery-instructions" className="text-xs font-semibold">
                          Instrucciones de entrega para el cliente
                        </Label>
                        <Textarea
                          id="delivery-instructions"
                          value={current.delivery.instructions ?? ''}
                          onChange={(e) => patchDelivery('instructions', e.target.value)}
                          rows={2}
                          maxLength={500}
                          className="resize-none rounded-xl text-xs bg-background"
                          placeholder="Ej. El repartidor se comunicará por WhatsApp al salir."
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Retiro en Local ── */}
              <Card className="rounded-2xl border bg-card shadow-2xs overflow-hidden">
                <CardHeader className="p-5 sm:p-6 pb-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2.5">
                      <Store className="h-5 w-5 text-primary" />
                      <span>Retiro en Local / Mostrador (Pick-up)</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Paso 4
                    </Badge>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Permite que los clientes retiren sus compras en tu mostrador sin costo de envío.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border-2 p-4 bg-muted/15">
                    <div>
                      <p className="font-bold text-sm text-foreground">Habilitar Retiro en Local</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Opción sin costo adicional para retirar en mostrador.
                      </p>
                    </div>
                    <Switch
                      checked={current.pickup.enabled}
                      onCheckedChange={(v) => patchPickup('enabled', v)}
                      aria-label={`${current.pickup.enabled ? 'Deshabilitar' : 'Habilitar'} retiro en local`}
                    />
                  </div>

                  {current.pickup.enabled && (
                    <div className="space-y-3.5 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="pickup-estimated-time" className="text-xs font-semibold">
                          Tiempo estimado de preparación
                        </Label>
                        <Input
                          id="pickup-estimated-time"
                          value={current.pickup.estimatedTime}
                          onChange={(e) => patchPickup('estimatedTime', e.target.value)}
                          placeholder="Ej. Listo en 20–30 min"
                          maxLength={60}
                          className="h-10 rounded-xl text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pickup-instructions" className="text-xs font-semibold">
                          Instrucciones para el cliente al retirar
                        </Label>
                        <Textarea
                          id="pickup-instructions"
                          value={current.pickup.instructions ?? ''}
                          onChange={(e) => patchPickup('instructions', e.target.value)}
                          rows={2}
                          maxLength={500}
                          className="resize-none rounded-xl text-xs bg-background"
                          placeholder="Ej. Presentar el número de pedido al llegar. Atendemos por orden de llegada."
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Ajustes Generales & Confirmación ── */}
              <Card className="rounded-2xl border bg-card shadow-2xs overflow-hidden">
                <CardHeader className="p-5 sm:p-6 pb-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2.5">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Ajustes Generales y Confirmación</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Paso 5
                    </Badge>
                  </div>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Reglas de compra y mensaje de agradecimiento al finalizar el pedido.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 sm:p-6 pt-0 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-minimum-order" className="text-xs font-semibold">
                      Monto mínimo de pedido (Gs.)
                    </Label>
                    <Input
                      id="checkout-minimum-order"
                      type="number"
                      min={0}
                      step={1000}
                      value={current.minOrderAmount || ''}
                      onChange={(e) => patch('minOrderAmount', Number(e.target.value) || 0)}
                      placeholder="0 = sin mínimo"
                      className="h-10 max-w-xs rounded-xl text-xs bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">0 permite pedidos de cualquier importe.</p>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label htmlFor="checkout-confirmation-message" className="text-xs font-semibold">
                      Mensaje de confirmación en pantalla
                    </Label>
                    <Textarea
                      id="checkout-confirmation-message"
                      value={current.confirmationMessage ?? ''}
                      onChange={(e) => patch('confirmationMessage', e.target.value)}
                      rows={2}
                      maxLength={500}
                      className="resize-none rounded-xl text-xs bg-background"
                      placeholder="Ej. ¡Gracias por tu compra! Estamos preparando tu pedido y nos comunicaremos en breve."
                    />
                    <p className="text-[11px] text-muted-foreground">Se muestra en la pantalla de éxito tras confirmar la orden.</p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-2xl border bg-card shadow-2xs">
              <CardHeader className="p-5 sm:p-6">
                <CardTitle className="text-base sm:text-lg font-bold">
                  {commerceMode === 'whatsapp' ? 'Modalidad: Consultas por WhatsApp' : 'Modalidad: Solo Catálogo'}
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Las configuraciones de métodos de pago y zonas de entrega se conservan guardadas y se reactivarán si decides volver a activar el carrito.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 pt-0">
                <div className="rounded-2xl border border-dashed bg-muted/20 p-4 sm:p-5 text-xs sm:text-sm text-muted-foreground space-y-1.5">
                  <p className="font-bold text-foreground">
                    {commerceMode === 'whatsapp' ? '💬 ¿Cómo funciona este modo?' : '👁️ ¿Cómo funciona este modo?'}
                  </p>
                  <p className="leading-relaxed">
                    {commerceMode === 'whatsapp'
                      ? 'El botón de carrito se oculta y cada producto incluye un botón que abre WhatsApp con el producto y precio adjunto para atención directa.'
                      : 'Tus productos se muestran como una vitrina digital informativa con fotos, precios y detalles sin acciones de compra.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Panel lateral de vista previa en vivo */}
        <CheckoutCustomerPreview settings={current} />
      </div>

      {/* ── Barra de guardado persistente ── */}
      <div className="sticky bottom-0 z-30 -mx-2 rounded-2xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5" aria-live="polite">
            <span
              aria-hidden="true"
              className={cn(
                'h-3 w-3 rounded-full',
                hasChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              )}
            />
            <div>
              <p className="text-xs sm:text-sm font-bold text-foreground">
                {hasChanges ? 'Tienes cambios sin guardar' : 'Configuración al día'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {hasChanges
                  ? 'Guarda los cambios para que se apliquen en tu tienda web pública.'
                  : 'Tu tienda pública está usando la última configuración guardada.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:shrink-0">
            {hasChanges && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(null)}
                disabled={isSaving}
                className="rounded-xl text-xs text-muted-foreground"
              >
                Descartar
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              aria-describedby="checkout-readiness"
              className="min-w-[160px] gap-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-xs h-9 px-4"
            >
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
                : <><Save className="h-4 w-4" /> Guardar cambios</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
