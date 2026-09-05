import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_RECEIPT_SETTINGS } from '@/lib/repairs/receipt-settings'
import { FALLBACK_WARRANTY_POLICY } from '@/hooks/use-repair-warranty-policy'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const HOOK = leer('src/hooks/use-repair-warranty-policy.ts')
const AJUSTES = leer('src/components/repairs/admin/WarrantyPolicySettings.tsx')
const FORMULARIO = leer('src/components/dashboard/repair-form-dialog-v2.tsx')

/**
 * Habia tres pantallas configurando la misma garantía, con tres almacenes
 * distintos y ninguna mirando a las otras:
 *
 *   1. El diálogo del comprobante → `organization_settings.repair_receipt_settings`
 *   2. /dashboard/repairs/settings → `localStorage.repair_default_warranty_*`
 *   3. El formulario de nueva reparación → `localStorage.4g_default_repair_warranty`
 *
 * Configurar la política en Ajustes no cambiaba nada en el formulario, y lo que
 * se guardaba desde el formulario vivía en ese navegador: dos computadoras del
 * mismo local tenían políticas distintas.
 */
describe('una sola garantía predeterminada, la de la empresa', () => {
  it('el valor de respaldo es el mismo del comprobante', () => {
    // Si divergieran, el formulario y el comprobante impreso dirían cosas
    // distintas sobre la misma orden.
    expect(FALLBACK_WARRANTY_POLICY).toEqual({
      months: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyMonths,
      type: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyType,
      notes: DEFAULT_RECEIPT_SETTINGS.defaultWarrantyNotes,
    })
  })

  it('lee y guarda contra la configuración de la empresa', () => {
    expect(HOOK).toContain("fetch('/api/repairs/receipt-settings')")
    expect(HOOK).toContain("method: 'PUT'")
    expect(HOOK).toContain('defaultWarrantyMonths: next.months')
  })

  it('al guardar manda el comprobante completo, no solo la garantía', () => {
    // La API normaliza contra los valores por defecto, no contra lo guardado:
    // un PUT parcial reseteaba el formato de papel, el logo y el texto legal.
    const fn = HOOK.slice(HOOK.indexOf('const save = useCallback'))
    expect(fn.slice(0, 700)).toContain('...settingsRef.current,')
  })

  it('no pierde lo que el taller ya había configurado', () => {
    // Un local que puso 6 meses en la pantalla vieja volvería a 3 sin aviso.
    expect(HOOK).toContain('repair_default_warranty_months')
    expect(HOOK).toContain('4g_default_repair_warranty')
    expect(HOOK).toContain('body.persisted ? desdeServidor : { ...desdeServidor, ...readLegacyPolicy() }')
  })
})

describe('la pantalla de Ajustes ya no guarda en el navegador', () => {
  it('usa el hook compartido', () => {
    expect(AJUSTES).toContain('useRepairWarrantyPolicy()')
  })

  it('no queda ninguna escritura a localStorage', () => {
    const soloCodigo = AJUSTES
      .split(/\r?\n/)
      .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
      .join(' ')
    expect(soloCodigo).not.toContain('localStorage.setItem')
    expect(soloCodigo).not.toContain('localStorage.getItem')
  })

  it('solo un administrador puede guardarla', () => {
    // La política es del taller, no de quien está atendiendo el mostrador.
    expect(AJUSTES).toContain('disabled={loading || saving || !canEdit}')
    expect(AJUSTES).toContain('Solo un administrador puede cambiar la garantía del taller')
  })

  it('avisa cuando lo que se ve todavía no está guardado', () => {
    expect(AJUSTES).toContain('Todavía no guardaste la política del taller')
  })
})

describe('el formulario de reparación toma la del taller', () => {
  it('ya no tiene su propio almacén local', () => {
    expect(FORMULARIO).not.toContain('getSavedWarrantyPreference')
    expect(FORMULARIO).not.toContain('saveWarrantyPreference')
    expect(FORMULARIO).not.toContain("'4g_default_repair_warranty'")
  })

  it('la aplica al abrir una orden nueva', () => {
    expect(FORMULARIO).toContain('useRepairWarrantyPolicy(open)')
    expect(FORMULARIO).toContain("setValue('warrantyMonths', warrantyPolicy.policy.months)")
  })

  it('no pisa lo que la persona ya escribió', () => {
    // La política llega del servidor unos milisegundos después de abrir el
    // formulario: si para entonces ya tocaron el campo, gana lo que escribieron.
    const efecto = FORMULARIO.slice(FORMULARIO.indexOf('const garantiaAplicadaRef'))
    expect(efecto.slice(0, 900)).toContain('const sinTocar =')
    expect(efecto.slice(0, 900)).toContain('if (!sinTocar) return')
  })

  it('no la aplica al editar una orden existente', () => {
    // Una orden ya emitida tiene la garantía con la que se firmó el comprobante.
    const efecto = FORMULARIO.slice(FORMULARIO.indexOf('const garantiaAplicadaRef'))
    expect(efecto.slice(0, 900)).toContain("mode !== 'add'")
    expect(efecto.slice(0, 900)).toContain('initialData?.warrantyMonths !== undefined')
  })

  it('«Fijar como Predeterminada» guarda para todo el taller', () => {
    expect(FORMULARIO).toContain('guardarGarantiaDelTaller')
    expect(FORMULARIO).toContain('La toman todas las órdenes nuevas')
  })

  it('la estrella marca la del taller, no la del navegador', () => {
    expect(FORMULARIO).toContain('warrantyPolicy.policy.months === preset.months')
    expect(FORMULARIO).toContain('Predeterminada del taller')
  })
})
