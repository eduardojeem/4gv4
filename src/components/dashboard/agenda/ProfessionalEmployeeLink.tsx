'use client'

import { useEffect, useState } from 'react'
import { Coins, Loader2, Sparkles, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InviteBarberDialog } from '@/components/dashboard/agenda/InviteBarberDialog'
import { cn } from '@/lib/utils'
import type { AgendaProfessional } from '@/lib/agenda/agenda-server'

type Employee = { id: string; name: string; role: string }
type RemunerationType = 'commission' | 'hybrid' | 'fixed' | 'chair_rental'

const SERVICE_PRESETS = [40, 50, 60, 70]
const PRODUCT_PRESETS = [0, 5, 10, 15]

/**
 * Esquema de comisiones y vínculo con empleado para barberías y salones.
 * Permite definir el % de servicios, % de reventa de productos y deducción de descartables,
 * además de atribuir los turnos en el POS a su usuario.
 */
export function ProfessionalEmployeeLink({ professionalId, onSaved }: { professionalId: string; onSaved?: (patch: Partial<AgendaProfessional>) => void }) {
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [userId, setUserId] = useState<string>('')
  const [remunerationType, setRemunerationType] = useState<RemunerationType>('commission')
  const [commissionRateServices, setCommissionRateServices] = useState<number>(50)
  const [commissionRateProducts, setCommissionRateProducts] = useState<number>(10)
  const [commissionFixedDeduction, setCommissionFixedDeduction] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/agenda/professionals/employee?id=${encodeURIComponent(professionalId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: {
        available?: boolean
        employees?: Employee[]
        userId?: string | null
        remunerationType?: RemunerationType
        commissionRateServices?: number
        commissionRateProducts?: number
        commissionFixedDeduction?: number
      } | null) => {
        if (cancelled) return
        setAvailable(Boolean(payload?.available))
        setEmployees(payload?.employees ?? [])
        setUserId(payload?.userId ?? '')
        if (payload?.remunerationType) setRemunerationType(payload.remunerationType)
        if (typeof payload?.commissionRateServices === 'number') setCommissionRateServices(payload.commissionRateServices)
        if (typeof payload?.commissionRateProducts === 'number') setCommissionRateProducts(payload.commissionRateProducts)
        if (typeof payload?.commissionFixedDeduction === 'number') setCommissionFixedDeduction(payload.commissionFixedDeduction)
      })
      .catch(() => { if (!cancelled) setAvailable(false) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [professionalId])

  if (loading || !available) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/agenda/professionals/employee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: professionalId,
          userId: userId || null,
          remunerationType,
          commissionRateServices: Number(commissionRateServices) || 0,
          commissionRateProducts: Number(commissionRateProducts) || 0,
          commissionFixedDeduction: Number(commissionFixedDeduction) || 0,
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudieron guardar las comisiones')
      onSaved?.({ user_id: userId || null, remuneration_type: remunerationType, commission_rate_services: Number(commissionRateServices) || 0, commission_rate_products: Number(commissionRateProducts) || 0, commission_fixed_deduction: Number(commissionFixedDeduction) || 0 })
      toast.success('Comisiones y vínculo guardados correctamente')
      setIsDirty(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  // Cálculos ilustrativos para el simulador
  const sampleCutPrice = 40000
  const sampleCutBarberGross = (sampleCutPrice * (commissionRateServices / 100)) - (commissionFixedDeduction || 0)
  const sampleCutBarberEarn = Math.max(0, sampleCutBarberGross)
  const sampleCutShopEarn = sampleCutPrice - sampleCutBarberEarn

  const samplePomadePrice = 50000
  const samplePomadeBarberEarn = samplePomadePrice * (commissionRateProducts / 100)

  return (
    <div className="space-y-4 rounded-2xl border border-primary/20 bg-muted/20 p-4">
      <fieldset disabled={saving} className="contents">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Coins className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Comisiones y liquidación</h4>
            <p className="text-xs text-muted-foreground">Configurá cómo cobra este barbero o estilista.</p>
          </div>
        </div>
        {isDirty && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
            Sin guardar
          </span>
        )}
      </div>

      {/* Vínculo con usuario empleado */}
      <div className="space-y-1.5">
        <Label htmlFor={`professional-employee-${professionalId}`} className="flex items-center justify-between text-xs font-semibold">
          <span>Usuario en el sistema (para cobros POS)</span>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        </Label>
        <select
          id={`professional-employee-${professionalId}`}
          value={userId}
          onChange={(event) => {
            setUserId(event.target.value)
            setIsDirty(true)
          }}
          disabled={saving}
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm font-medium transition-colors focus:border-primary focus:outline-hidden"
        >
          <option value="">Sin vincular a usuario (solo cálculo interno)</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.role})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {userId
              ? 'Usuario del sistema vinculado. Los servicios se le atribuyen automáticamente.'
              : '¿El barbero aún no tiene cuenta de usuario?'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInviteOpen(true)}
            className="h-7 gap-1 text-xs text-primary border-primary/30 hover:bg-primary/10"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {userId ? 'Reenviar acceso / WhatsApp' : 'Invitar a registrarse'}
          </Button>
        </div>
      </div>

      <InviteBarberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        professional={{ id: professionalId, name: 'este profesional' }}
        onSuccess={(newUserId) => {
          setUserId(newUserId)
          onSaved?.({ user_id: newUserId })
        }}
      />

      {/* Tipo de remuneración */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Modalidad de remuneración</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { id: 'commission', label: 'Comisión (%)', desc: 'Porcentaje por corte y reventa' },
            { id: 'hybrid', label: 'Fijo + Comisión', desc: 'Sueldo base + porcentaje' },
            { id: 'chair_rental', label: 'Alquiler sillón', desc: 'Cuota fija acordada' },
            { id: 'fixed', label: 'Sueldo fijo', desc: 'Sin porcentaje por servicio' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => {
                setRemunerationType(mode.id as RemunerationType)
                setIsDirty(true)
              }}
              className={cn(
                'flex flex-col items-start justify-center rounded-xl border p-2.5 text-left transition-all',
                remunerationType === mode.id
                  ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="text-xs font-bold leading-tight">{mode.label}</span>
              <span className="mt-0.5 text-[10px] leading-tight opacity-80">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Campos de porcentaje cuando comisiona */}
      {(remunerationType === 'commission' || remunerationType === 'hybrid') && (
        <div className="space-y-3.5 rounded-xl border bg-card p-3 shadow-2xs">
          {/* Comisión en servicios */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="comm-services" className="text-xs font-semibold text-foreground">
                Comisión en Servicios (Cortes, barba, etc.)
              </Label>
              <div className="flex items-center gap-1">
                {SERVICE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCommissionRateServices(preset)
                      setIsDirty(true)
                    }}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors',
                      commissionRateServices === preset
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Input
                id="comm-services"
                type="number"
                min={0}
                max={100}
                step={1}
                value={commissionRateServices}
                onChange={(event) => {
                  setCommissionRateServices(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                  setIsDirty(true)
                }}
                className="h-10 rounded-xl pr-8 font-bold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* Comisión en productos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="comm-products" className="text-xs font-semibold text-foreground">
                Comisión en Venta de Productos (Pomadas, ceras, etc.)
              </Label>
              <div className="flex items-center gap-1">
                {PRODUCT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCommissionRateProducts(preset)
                      setIsDirty(true)
                    }}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors',
                      commissionRateProducts === preset
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Input
                id="comm-products"
                type="number"
                min={0}
                max={100}
                step={1}
                value={commissionRateProducts}
                onChange={(event) => {
                  setCommissionRateProducts(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                  setIsDirty(true)
                }}
                className="h-10 rounded-xl pr-8 font-bold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Incentivo para que el barbero recomiende productos del local en el sillón.
            </p>
          </div>

          {/* Descuento por insumos descartables */}
          <div className="space-y-1.5 border-t pt-2.5">
            <Label htmlFor="comm-deduction" className="text-xs font-semibold text-foreground">
              Deducción fija por insumo/descartable <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="relative">
              <Input
                id="comm-deduction"
                type="number"
                min={0}
                step={1000}
                value={commissionFixedDeduction || ''}
                placeholder="0"
                onChange={(event) => {
                  setCommissionFixedDeduction(Math.max(0, Number(event.target.value) || 0))
                  setIsDirty(true)
                }}
                className="h-10 rounded-xl pr-12 font-bold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                Gs.
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Monto a descontar por servicio si el local suministra hojas descartables, toallas o papel cuello.
            </p>
          </div>

          {/* Simulador dinámico ilustrativo */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Ejemplo con estos valores:
            </p>
            <ul className="mt-1.5 space-y-1 text-foreground/90">
              <li>
                💈 <strong>Corte de 40.000 Gs:</strong> El barbero cobra{' '}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {sampleCutBarberEarn.toLocaleString('es-PY')} Gs
                </span>{' '}
                y la barbería retiene{' '}
                <span className="font-bold text-muted-foreground">
                  {sampleCutShopEarn.toLocaleString('es-PY')} Gs
                </span>
                {commissionFixedDeduction > 0 && ` (con -${commissionFixedDeduction.toLocaleString('es-PY')} Gs de descartables)`}.
              </li>
              {commissionRateProducts > 0 && (
                <li>
                  🧴 <strong>Pomada de 50.000 Gs:</strong> El barbero cobra{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {samplePomadeBarberEarn.toLocaleString('es-PY')} Gs
                  </span>{' '}
                  por recomendarla.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {remunerationType === 'chair_rental' && (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-card p-3.5 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              💈
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Modalidad Alquiler de Sillón</p>
              <p className="text-[11px] text-muted-foreground">
                El barbero retiene el 100% de lo que cobra por sus cortes y abona un canon periódico fijo al salón.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="chair-rental-amount" className="text-xs font-semibold text-foreground">
                Monto del alquiler de sillón acordado
              </Label>
              <div className="flex items-center gap-1">
                {[200000, 350000, 500000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCommissionFixedDeduction(preset)
                      setIsDirty(true)
                    }}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors',
                      commissionFixedDeduction === preset
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {(preset / 1000).toLocaleString('es-PY')}k
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <Input
                id="chair-rental-amount"
                type="number"
                min={0}
                step={50000}
                value={commissionFixedDeduction || ''}
                placeholder="ej: 350.000"
                onChange={(event) => {
                  setCommissionFixedDeduction(Math.max(0, Number(event.target.value) || 0))
                  setIsDirty(true)
                }}
                className="h-10 rounded-xl pr-12 font-bold tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                Gs.
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Canon periódico (semanal o mensual). Se descontará automáticamente en la liquidación de la agenda o se cobra como ingreso en la Caja del POS.
            </p>
          </div>

          {commissionFixedDeduction > 0 && (
            <div className="rounded-lg bg-primary/5 p-2.5 text-xs text-primary font-medium border border-primary/15">
              💰 <b>Canon para la barbería:</b> {commissionFixedDeduction.toLocaleString('es-PY')} Gs por período. El barbero cobra el 100% de los servicios directo o se le liquida descontando este alquiler.
            </div>
          )}
        </div>
      )}

      {remunerationType === 'fixed' && (
        <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Modalidad Sueldo Fijo</p>
          <p className="mt-1">
            El profesional percibe un sueldo fijo acordado independientemente de la cantidad de cortes atendidos.
          </p>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !isDirty}
          className="h-9 gap-1.5 rounded-xl font-bold"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Guardar comisiones
        </Button>
      </div>
      </fieldset>
    </div>
  )
}
