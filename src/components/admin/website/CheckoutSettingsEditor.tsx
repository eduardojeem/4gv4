'use client'

import { useState } from 'react'
import { useAdminWebsiteSettings } from '@/hooks/useWebsiteSettings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { CheckoutSettings, PaymentMethodConfig } from '@/types/website-settings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  CheckCircle2, CreditCard, Loader2, Save, Store, Truck, Wallet,
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
  const set = (field: keyof PaymentMethodConfig, val: string | boolean) =>
    onChange(pmKey, { ...config, [field]: val })

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-all',
      config.enabled ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/10 opacity-70'
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
            config.enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">{meta.label}</p>
            <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
          </div>
        </div>
        <Switch checked={config.enabled} onCheckedChange={(v) => set('enabled', v)} />
      </div>

      {config.enabled && (
        <div className="space-y-2.5 pt-1">
          {/* Custom label */}
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta en el checkout</Label>
            <Input value={config.label ?? ''} onChange={(e) => set('label', e.target.value)}
              placeholder={meta.label} className="h-8 rounded-xl text-xs" />
          </div>

          {/* Instructions shown to customer */}
          <div className="space-y-1">
            <Label className="text-xs">Instrucciones para el cliente</Label>
            <Textarea value={config.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)}
              rows={2} className="rounded-xl text-xs resize-none"
              placeholder="Ej. Te contactaremos por WhatsApp con los datos de pago." />
          </div>

          {/* Transfer-specific */}
          {pmKey === 'transfer' && (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Alias</Label>
                <Input value={config.bankAlias ?? ''} onChange={(e) => set('bankAlias', e.target.value)}
                  placeholder="mi-alias" className="h-8 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CBU / CCI</Label>
                <Input value={config.bankCbu ?? ''} onChange={(e) => set('bankCbu', e.target.value)}
                  placeholder="0000000000000000000000" className="h-8 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Banco</Label>
                <Input value={config.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)}
                  placeholder="Ej. Banco Itaú" className="h-8 rounded-xl text-xs" />
              </div>
            </div>
          )}

          {/* Digital wallet-specific */}
          {pmKey === 'digital_wallet' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Alias de billetera</Label>
                <Input value={config.walletAlias ?? ''} onChange={(e) => set('walletAlias', e.target.value)}
                  placeholder="Ej. mi.negocio" className="h-8 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL del QR (imagen)</Label>
                <Input value={config.qrImageUrl ?? ''} onChange={(e) => set('qrImageUrl', e.target.value)}
                  placeholder="https://..." className="h-8 rounded-xl text-xs" />
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
    <div className="space-y-8 max-w-3xl">

      {/* ── Payment methods ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" /> Métodos de pago
          </CardTitle>
          <CardDescription>
            Habilitá los métodos que aceptás y configurá los datos que verá el cliente al elegir cada uno.
          </CardDescription>
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="font-semibold text-sm">Ofrecer envío a domicilio</p>
              <p className="text-xs text-muted-foreground mt-0.5">Si está desactivado, los clientes solo podrán elegir retiro en local.</p>
            </div>
            <Switch
              checked={current.delivery.enabled}
              onCheckedChange={(v) => patchDelivery('enabled', v)}
            />
          </div>

          {current.delivery.enabled && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Costo de envío por defecto (Gs.)</Label>
                  <Input
                    type="number" min={0} step={500}
                    value={current.delivery.defaultCost || ''}
                    onChange={(e) => patchDelivery('defaultCost', Number(e.target.value) || 0)}
                    placeholder="0"
                    className="h-9 rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">Se pre-carga en el carrito. El cliente puede ajustarlo.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Envío gratis desde (Gs.)</Label>
                  <Input
                    type="number" min={0} step={1000}
                    value={current.delivery.freeThreshold || ''}
                    onChange={(e) => patchDelivery('freeThreshold', Number(e.target.value) || 0)}
                    placeholder="0 = siempre pago"
                    className="h-9 rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">0 significa que siempre se cobra.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tiempo estimado</Label>
                  <Input
                    value={current.delivery.estimatedTime}
                    onChange={(e) => patchDelivery('estimatedTime', e.target.value)}
                    placeholder="Ej. 30–60 min"
                    className="h-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Zonas de cobertura</Label>
                <Input
                  value={current.delivery.zones ?? ''}
                  onChange={(e) => patchDelivery('zones', e.target.value)}
                  placeholder="Ej. Asunción, San Lorenzo, Luque y alrededores"
                  className="h-9 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Instrucciones adicionales para el cliente</Label>
                <Textarea
                  value={current.delivery.instructions ?? ''}
                  onChange={(e) => patchDelivery('instructions', e.target.value)}
                  rows={2} className="rounded-xl resize-none text-sm"
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="font-semibold text-sm">Ofrecer retiro en local</p>
              <p className="text-xs text-muted-foreground mt-0.5">Si está desactivado, los clientes solo podrán elegir delivery.</p>
            </div>
            <Switch
              checked={current.pickup.enabled}
              onCheckedChange={(v) => patchPickup('enabled', v)}
            />
          </div>

          {current.pickup.enabled && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tiempo estimado de preparación</Label>
                <Input
                  value={current.pickup.estimatedTime}
                  onChange={(e) => patchPickup('estimatedTime', e.target.value)}
                  placeholder="Ej. 20–30 min"
                  className="h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Instrucciones para el cliente</Label>
                <Textarea
                  value={current.pickup.instructions ?? ''}
                  onChange={(e) => patchPickup('instructions', e.target.value)}
                  rows={2} className="rounded-xl resize-none text-sm"
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Monto mínimo de pedido (Gs.)</Label>
            <Input
              type="number" min={0} step={1000}
              value={current.minOrderAmount || ''}
              onChange={(e) => patch('minOrderAmount', Number(e.target.value) || 0)}
              placeholder="0 = sin mínimo"
              className="h-9 rounded-xl max-w-xs"
            />
            <p className="text-[11px] text-muted-foreground">Los clientes no podrán confirmar pedidos por debajo de este monto.</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs">Mensaje de confirmación</Label>
            <Textarea
              value={current.confirmationMessage ?? ''}
              onChange={(e) => patch('confirmationMessage', e.target.value)}
              rows={2} className="rounded-xl resize-none text-sm"
              placeholder="Ej. ¡Gracias por tu pedido! Nos contactaremos por WhatsApp en breve para coordinar."
            />
            <p className="text-[11px] text-muted-foreground">Se muestra en la pantalla de éxito después de confirmar el pedido.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {hasChanges && (
          <Button variant="ghost" onClick={() => setDraft(null)} className="rounded-xl text-muted-foreground">
            Descartar cambios
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="gap-2 rounded-xl min-w-[140px]"
        >
          {isSaving
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</>
            : <><Save className="h-4 w-4" /> Guardar cambios</>
          }
        </Button>
      </div>
    </div>
  )
}
