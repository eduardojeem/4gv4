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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  AlertTriangle, CheckCircle2, CreditCard, Loader2, Save, Store, Truck, Wallet, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Payment method labels & icons ───────────────────────────────────────────
const PM_META = {
  cash:           { label: 'Efectivo',          Icon: Wallet,      hint: 'Pago al retirar o al recibir el delivery.' },
  card:           { label: 'Tarjeta',           Icon: CreditCard,  hint: 'Posnet en el local o a domicilio.' },
  transfer:       { label: 'Transferencia',     Icon: CreditCard,  hint: 'Ingresá Alias, CBU y banco para mostrarlo al cliente.' },
  digital_wallet: { label: 'Billetera digital', Icon: Wallet,      hint: 'MercadoPago, Modo, etc. Podés cargar el Alias o QR.' },
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
      'space-y-3 rounded-lg border p-4 transition-colors',
      config.enabled ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/10 opacity-70'
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            config.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">{meta.label}</p>
            <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => set('enabled', v)}
          aria-label={`${config.enabled ? 'Deshabilitar' : 'Habilitar'} ${meta.label}`}
        />
      </div>

      {config.enabled && (
        <div className="space-y-2.5 pt-1">
          {/* Custom label */}
          <div className="space-y-1">
            <Label htmlFor={`${pmKey}-label`} className="text-xs">Etiqueta en el checkout</Label>
            <Input id={`${pmKey}-label`} value={config.label ?? ''} onChange={(e) => set('label', e.target.value)}
              placeholder={meta.label} maxLength={60} className="h-9 rounded-md text-xs" />
          </div>

          {/* Instructions shown to customer */}
          <div className="space-y-1">
            <Label htmlFor={`${pmKey}-instructions`} className="text-xs">Instrucciones para el cliente</Label>
            <Textarea id={`${pmKey}-instructions`} value={config.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)}
              rows={2} maxLength={500} className="resize-none rounded-md text-xs"
              placeholder="Ej. Te contactaremos por WhatsApp con los datos de pago." />
          </div>

          {/* Transfer-specific */}
          {pmKey === 'transfer' && (
            <BankTransferOptionsEditor
              options={getTransferOptions(config)}
              onChange={(options) => set('transferOptions', options)}
            />
          )}

          {/* Digital wallet-specific */}
          {pmKey === 'digital_wallet' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wallet-alias" className="text-xs">Alias de billetera</Label>
                <Input id="wallet-alias" value={config.walletAlias ?? ''} onChange={(e) => set('walletAlias', e.target.value)}
                  placeholder="Ej. mi.negocio" maxLength={100} className="h-9 rounded-md text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wallet-qr-url" className="text-xs">URL del QR (imagen)</Label>
                <Input id="wallet-qr-url" type="url" value={config.qrImageUrl ?? ''} onChange={(e) => set('qrImageUrl', e.target.value)}
                  placeholder="https://..." maxLength={500} className="h-9 rounded-md text-xs" />
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

  // lastSaved holds the value we last persisted so the form doesn't flash
  // empty when SWR revalidation hasn't propagated yet after saving.
  const [lastSaved, setLastSaved] = useState<CheckoutSettings | null>(null)
  const [draft, setDraft]         = useState<CheckoutSettings | null>(null)

  // Priority: draft (unsaved edits) > lastSaved (persisted this session) > DB value > defaults
  const baseline: CheckoutSettings = lastSaved ?? settings?.checkout ?? defaultCheckout
  const current:  CheckoutSettings = draft ?? baseline
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
    ? 'Falta un método de pago'
    : !hasFulfillmentOption
      ? 'Falta delivery o retiro'
      : !hasValidTransferOptions
        ? 'Revisá las cuentas bancarias'
        : !hasValidDeliveryZones
          ? 'Revisá las zonas de delivery'
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

    const savedValue = draft  // capture before state clears
    const result = await updateSetting('checkout', savedValue)
    if (result?.success === false) {
      toast.error('Error al guardar', { description: result.error })
    } else {
      toast.success('Configuración de checkout guardada')
      setLastSaved(savedValue)  // keep locally so form stays populated
      setDraft(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-6">

      <CommerceModeSelector
        value={commerceMode}
        onChange={(mode) => patch('commerceMode', mode)}
      />

      <div className="flex items-start gap-2.5 border-l-2 border-primary/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">
            {commerceMode === 'cart'
              ? 'Qué cambia en el carrito'
              : commerceMode === 'whatsapp'
                ? 'Cómo funcionan las consultas'
                : 'Cómo funciona el catálogo'}
          </span>
          <p className="leading-relaxed text-muted-foreground">
            {commerceMode === 'cart'
              ? 'Los métodos habilitados aparecen al pagar. Delivery y retiro definen cómo recibe el cliente su compra y qué costos se suman al pedido.'
              : commerceMode === 'whatsapp'
                ? 'El carrito se oculta y cada producto muestra un acceso a WhatsApp usando el número configurado en Datos de empresa.'
                : 'El carrito y las acciones de compra se ocultan. Los clientes pueden explorar productos, precios y detalles.'}
          </p>
        </div>
      </div>

      <div
        id="checkout-readiness"
        role="status"
        className={cn(
          'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
          isCheckoutReady
            ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20'
            : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'
        )}
      >
        <div className="flex items-start gap-3">
          {isCheckoutReady
            ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          }
          <div>
            <p className="text-sm font-semibold">
              {commerceMode === 'cart'
                ? isCheckoutReady ? 'Checkout listo para recibir pedidos' : 'Configuración incompleta'
                : commerceMode === 'whatsapp'
                  ? 'Tienda configurada para consultas'
                  : 'Tienda configurada como catálogo'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {commerceMode === 'cart'
                ? <>
                    {enabledPaymentCount} {enabledPaymentCount === 1 ? 'método de pago activo' : 'métodos de pago activos'}
                    {' · '}
                    {[current.delivery.enabled && 'delivery', current.pickup.enabled && 'retiro'].filter(Boolean).join(' y ') || 'sin forma de entrega'}
                  </>
                : commerceMode === 'whatsapp'
                  ? 'Sin checkout · contacto directo por producto'
                  : 'Sin checkout · navegación informativa'}
            </p>
          </div>
        </div>
        {!isCheckoutReady && (
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
            {checkoutIssue}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-6">
      {commerceMode === 'cart' ? (
        <>
      {/* ── Payment methods ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" /> Métodos de pago
          </CardTitle>
          <CardDescription>
            Habilitá los métodos que aceptás y configurá los datos que verá el cliente al elegir cada uno.
          </CardDescription>
          <SectionHowItWorks
            sectionName="los métodos de pago"
            steps={[
              {
                title: 'Habilitá lo que aceptás',
                description: 'Solo los métodos activos aparecerán como opciones en el carrito.',
              },
              {
                title: 'Personalizá el mensaje',
                description: 'La etiqueta y las instrucciones explican al cliente cómo completar ese pago.',
              },
              {
                title: 'El cliente elige',
                description: 'Antes de confirmar el pedido, seleccionará uno de los métodos disponibles.',
              },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-3">
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

      {/* ── Delivery settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" /> Envío a domicilio
          </CardTitle>
          <CardDescription>
            Configurá si ofrecés delivery y los costos por defecto que aparecerán en el carrito.
          </CardDescription>
          <SectionHowItWorks
            sectionName="el envío a domicilio"
            steps={[
              {
                title: 'Activá delivery',
                description: 'Al habilitarlo, el cliente podrá elegir envío a domicilio en el carrito.',
              },
              {
                title: 'Definí zonas y tarifas',
                description: 'Podés cobrar un monto distinto por zona o marcar una zona con delivery gratis.',
              },
              {
                title: 'Configurá el envío gratis',
                description: 'Al alcanzar ese monto, el carrito elimina automáticamente el costo de entrega.',
              },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-semibold text-sm">Ofrecer envío a domicilio</p>
              <p className="text-xs text-muted-foreground mt-0.5">Si está desactivado, los clientes solo podrán elegir retiro en local.</p>
            </div>
            <Switch
              checked={current.delivery.enabled}
              onCheckedChange={(v) => patchDelivery('enabled', v)}
              aria-label={`${current.delivery.enabled ? 'Deshabilitar' : 'Habilitar'} envío a domicilio`}
            />
          </div>

          {current.delivery.enabled && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-default-cost" className="text-xs">Costo de envío por defecto (Gs.)</Label>
                  <Input
                    id="delivery-default-cost"
                    type="number" min={0} step={500}
                    value={current.delivery.defaultCost || ''}
                    onChange={(e) => patchDelivery('defaultCost', Number(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9 rounded-md"
                  />
                  <p className="text-[10px] text-muted-foreground">Se usa cuando no configuraste una tarifa específica para la zona.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-free-threshold" className="text-xs">Envío gratis desde (Gs.)</Label>
                  <Input
                    id="delivery-free-threshold"
                    type="number" min={0} step={1000}
                    value={current.delivery.freeThreshold || ''}
                    onChange={(e) => patchDelivery('freeThreshold', Number(e.target.value) || 0)}
                    placeholder="0 = siempre pago"
                    className="h-9 rounded-md"
                  />
                  <p className="text-[10px] text-muted-foreground">0 significa que siempre se cobra.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delivery-estimated-time" className="text-xs">Tiempo estimado</Label>
                  <Input
                    id="delivery-estimated-time"
                    value={current.delivery.estimatedTime}
                    onChange={(e) => patchDelivery('estimatedTime', e.target.value)}
                    placeholder="Ej. 30–60 min"
                    maxLength={60}
                    className="h-9 rounded-md"
                  />
                </div>
              </div>

              <DeliveryZoneOptionsEditor
                zones={current.delivery.zoneOptions ?? []}
                onChange={(zones) => patchDelivery('zoneOptions', zones)}
              />

              <div className="space-y-1.5">
                <Label htmlFor="delivery-zones" className="text-xs">Descripción adicional de cobertura</Label>
                <Input
                  id="delivery-zones"
                  value={current.delivery.zones ?? ''}
                  onChange={(e) => patchDelivery('zones', e.target.value)}
                  placeholder="Ej. Consultá por otras ciudades y alrededores"
                  maxLength={300}
                  className="h-9 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery-instructions" className="text-xs">Instrucciones adicionales para el cliente</Label>
                <Textarea
                  id="delivery-instructions"
                  value={current.delivery.instructions ?? ''}
                  onChange={(e) => patchDelivery('instructions', e.target.value)}
                  rows={2} maxLength={500} className="resize-none rounded-md text-sm"
                  placeholder="Ej. Coordinaremos el horario exacto por WhatsApp."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pickup settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" /> Retiro en local
          </CardTitle>
          <CardDescription>Información sobre el retiro en persona.</CardDescription>
          <SectionHowItWorks
            sectionName="el retiro en local"
            steps={[
              {
                title: 'Activá el retiro',
                description: 'El cliente podrá seleccionar esta opción sin sumar un costo de entrega.',
              },
              {
                title: 'Indicá la preparación',
                description: 'El tiempo estimado ayuda a saber cuándo estará listo el pedido.',
              },
              {
                title: 'Agregá instrucciones',
                description: 'Podés explicar dónde presentarse o qué dato mostrar al retirar.',
              },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div>
              <p className="font-semibold text-sm">Ofrecer retiro en local</p>
              <p className="text-xs text-muted-foreground mt-0.5">Si está desactivado, los clientes solo podrán elegir delivery.</p>
            </div>
            <Switch
              checked={current.pickup.enabled}
              onCheckedChange={(v) => patchPickup('enabled', v)}
              aria-label={`${current.pickup.enabled ? 'Deshabilitar' : 'Habilitar'} retiro en local`}
            />
          </div>

          {current.pickup.enabled && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pickup-estimated-time" className="text-xs">Tiempo estimado de preparación</Label>
                <Input
                  id="pickup-estimated-time"
                  value={current.pickup.estimatedTime}
                  onChange={(e) => patchPickup('estimatedTime', e.target.value)}
                  placeholder="Ej. 20–30 min"
                  maxLength={60}
                  className="h-9 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup-instructions" className="text-xs">Instrucciones para el cliente</Label>
                <Textarea
                  id="pickup-instructions"
                  value={current.pickup.instructions ?? ''}
                  onChange={(e) => patchPickup('instructions', e.target.value)}
                  rows={2} maxLength={500} className="resize-none rounded-md text-sm"
                  placeholder="Ej. Mostrar el número de pedido al llegar. Estacionamiento disponible."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── General ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> General
          </CardTitle>
          <CardDescription>Ajustes generales del proceso de compra.</CardDescription>
          <SectionHowItWorks
            sectionName="los ajustes generales"
            steps={[
              {
                title: 'Definí un pedido mínimo',
                description: 'El cliente no podrá confirmar si el subtotal no alcanza ese importe. Cero elimina el mínimo.',
              },
              {
                title: 'Personalizá la confirmación',
                description: 'Este mensaje aparece después de registrar correctamente el pedido.',
              },
              {
                title: 'Revisá la vista previa',
                description: 'El panel lateral resume las opciones y valores visibles para el cliente.',
              },
            ]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="checkout-minimum-order" className="text-xs">Monto mínimo de pedido (Gs.)</Label>
            <Input
              id="checkout-minimum-order"
              type="number" min={0} step={1000}
              value={current.minOrderAmount || ''}
              onChange={(e) => patch('minOrderAmount', Number(e.target.value) || 0)}
              placeholder="0 = sin mínimo"
              className="h-9 max-w-xs rounded-md"
            />
            <p className="text-[11px] text-muted-foreground">Los clientes no podrán confirmar pedidos por debajo de este monto.</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="checkout-confirmation-message" className="text-xs">Mensaje de confirmación</Label>
            <Textarea
              id="checkout-confirmation-message"
              value={current.confirmationMessage ?? ''}
              onChange={(e) => patch('confirmationMessage', e.target.value)}
              rows={2} maxLength={500} className="resize-none rounded-md text-sm"
              placeholder="Ej. ¡Gracias por tu pedido! Nos contactaremos por WhatsApp en breve para coordinar."
            />
            <p className="text-[11px] text-muted-foreground">Se muestra en la pantalla de éxito después de confirmar el pedido.</p>
          </div>
        </CardContent>
      </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {commerceMode === 'whatsapp' ? 'Consultas activadas' : 'Catálogo sin compra'}
            </CardTitle>
            <CardDescription>
              Las configuraciones de pagos y entregas permanecen guardadas y volverán a usarse si reactivás el carrito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              {commerceMode === 'whatsapp'
                ? 'Verificá el teléfono o WhatsApp en Personalización visual → Datos de empresa.'
                : 'Los productos seguirán mostrando precio, disponibilidad y ficha completa.'}
            </div>
          </CardContent>
        </Card>
      )}
        </div>

        <CheckoutCustomerPreview settings={current} />
      </div>

      {/* ── Persistent save bar ── */}
      <div className="sticky bottom-0 z-30 -mx-2 border-t bg-background/95 px-2 py-3 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2" aria-live="polite">
            <span
              aria-hidden="true"
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                hasChanges ? 'bg-amber-500' : 'bg-emerald-500'
              )}
            />
            <div>
              <p className="text-sm font-semibold">
                {hasChanges ? 'Cambios sin guardar' : 'Todo guardado'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasChanges
                  ? 'Guardá para aplicar esta configuración en la tienda pública.'
                  : 'La tienda pública está usando la última configuración guardada.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 sm:shrink-0">
            {hasChanges && (
              <Button
                variant="ghost"
                onClick={() => setDraft(null)}
                disabled={isSaving}
                className="flex-1 rounded-md text-muted-foreground sm:flex-none"
              >
                Descartar
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              aria-describedby="checkout-readiness"
              className="min-w-[150px] flex-1 gap-2 rounded-md sm:flex-none"
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
