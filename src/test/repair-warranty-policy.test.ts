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
    // Pasa por la sincronización común, que también refresca la copia del
    // navegador con la que imprimen el detalle y el listado.
    expect(HOOK).toContain('refreshReceiptSettings({ force: true })')
    expect(HOOK).toContain('patchReceiptSettings({')
    expect(HOOK).toContain('defaultWarrantyMonths: clampWarrantyMonths(next.months)')
  })

  it('vuelve a cargar al habilitarse para no aplicar primero el respaldo de 3 meses', () => {
    const efectoDeCarga = HOOK.slice(
      HOOK.indexOf('useEffect(() => {'),
      HOOK.indexOf('return () => { vigente = false }'),
    )

    expect(efectoDeCarga).toContain('setLoading(true)')
  })

  it('al guardar manda solo la garantía, y el servidor la fusiona con lo guardado', () => {
    // Antes mandaba el comprobante entero leído al abrir. Si esa lectura había
    // fallado, mandaba los valores de fábrica y reseteaba papel, logo y texto
    // legal de toda la empresa. El PATCH fusiona en el servidor.
    const fn = HOOK.slice(HOOK.indexOf('const save = useCallback'))
    const cuerpo = fn.slice(0, fn.indexOf("if ('error' in result)"))
    expect(cuerpo).toContain('patchReceiptSettings({')
    expect(cuerpo).not.toContain('settingsRef')
    expect(cuerpo).not.toContain('paperFormat')
    expect(cuerpo).not.toContain('legalText')
  })

  it('no pierde lo que el taller ya había configurado', () => {
    // Un local que puso 6 meses en la pantalla vieja volvería a 3 sin aviso.
    expect(HOOK).toContain('repair_default_warranty_months')
    expect(HOOK).toContain('4g_default_repair_warranty')
    expect(HOOK).toContain('snapshot.persisted ? desdeServidor : { ...desdeServidor, ...readLegacyPolicy() }')
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

/**
 * La misma garantía se elegía en cuatro lugares con listas propias: con una
 * política de 2 meses el formulario quedaba en blanco, las cláusulas repetidas
 * no se detectaban y el tope de notas del taller (1000) bloqueaba el alta (500).
 */
describe('las pantallas de garantía usan las mismas reglas', () => {
  const soloCodigo = (fuente: string) => fuente
    .split(/\r?\n/)
    .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
    .join('\n')

  it('ninguna tiene su propia lista de meses', () => {
    for (const fuente of [FORMULARIO, AJUSTES]) {
      expect(fuente).toContain('warrantyMonthOptions(')
      expect(soloCodigo(fuente)).not.toMatch(/<SelectItem value="(0|1|2|3|6|12|24|36)">/)
    }
  })

  it('ni sus propias cláusulas', () => {
    expect(FORMULARIO.match(/WARRANTY_CLAUSES\.map/g)).toHaveLength(2)
    expect(AJUSTES).toContain('WARRANTY_CLAUSES.map')
    expect(FORMULARIO).toContain('appendClause(')
    expect(AJUSTES).toContain('appendClause(')
  })

  it('«Fijar como predeterminada» no se ofrece a quien no puede, ni sin la política cargada', () => {
    expect(FORMULARIO).toContain('const puedeFijarGarantia = warrantyPolicy.canEdit && !warrantyPolicy.loading && !warrantyPolicy.error')
    expect(FORMULARIO.match(/disabled=\{!puedeFijarGarantia\}/g)).toHaveLength(2)
  })

  it('una orden sin garantía no guarda notas ocultas', () => {
    expect(FORMULARIO).toContain(": data.warrantyMonths === 0 ? { ...data, warrantyNotes: '' } : data")
  })

  it('el formulario mantiene fresca la copia con la que se imprime', () => {
    expect(FORMULARIO).toContain('useEffect(() => { void refreshReceiptSettings() }, [])')
  })
})
