import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const detail = read('mobile/src/app/panel/repairs/[id].tsx')
const photos = read('mobile/src/components/repair-photos.tsx')
const photoApi = read('mobile/src/lib/repair-photos.ts')

/** Detalle de reparación en la app: lo que hace falta en el taller sin ir a la web. */
describe('detalle de reparación en la app', () => {
  it('se pueden sacar fotos con la cámara o elegirlas, verlas en grande y quitarlas', () => {
    expect(detail).toContain('<RepairPhotos')
    expect(photos).toContain('ImagePicker.launchCameraAsync')
    expect(photos).toContain('ImagePicker.launchImageLibraryAsync')
    expect(photos).toContain('contentFit="contain"')
    expect(photos).toContain('removeRepairPhoto(repair.id, photo.id)')
  })

  it('las fotos usan las mismas rutas y controles de plan que la web', () => {
    expect(photoApi).toContain("apiFetch<{ success?: boolean; path?: string; error?: string }>('/api/upload'")
    expect(photoApi).toContain("form.append('bucket', REPAIR_IMAGE_BUCKET)")
    expect(photoApi).toContain("const REPAIR_IMAGE_BUCKET = 'repair-images'")
    expect(photoApi).toContain('/images`, {\n    method: \'POST\'')
    expect(photoApi).toContain("method: 'DELETE'")
  })

  it('la acción que sigue está siempre en la barra de abajo', () => {
    expect(detail).toContain("label: 'Verificar y marcar listo'")
    expect(detail).toContain("label: 'Entregar equipo'")
    expect(detail).toContain("label: 'Presupuestar'")
    expect(detail).toContain('label: `Registrar pago · saldo ${formatGs(balance)}`')
    expect(detail).toContain('{primary && (')
    // Ya no se repiten en «Cambiar estado» ni usa el azul casi negro que no se veía en modo oscuro.
    expect(detail).not.toContain("backgroundColor: '#0F172A'")
    expect(detail).not.toContain("'Verificación técnica y marcar listo'")
  })

  it('el aviso de guardado flota y se ve desde cualquier pestaña', () => {
    expect(detail).toContain('styles.toast')
    expect(detail).toContain('setTimeout(() => setNotice(null), 5000)')
    const toast = detail.indexOf('styles.toast')
    const overviewTab = detail.indexOf("{detailTab==='overview'&&<>")
    const scrollEnd = detail.indexOf('</ScrollView>')
    expect(toast).toBeGreaterThan(scrollEnd)
    expect(overviewTab).toBeLessThan(scrollEnd)
  })

  it('muestra el historial de pagos con fecha, forma de pago y referencia', () => {
    expect(detail).toContain('title="Historial de pagos"')
    expect(detail).toContain('paymentMethodLabel(payment.payment_method)')
    expect(detail).toContain('formatPaymentDate(payment.created_at)')
    expect(detail).toContain('Ref. ${payment.reference}')
  })

  it('llamar avisa si el teléfono no puede hacer llamadas', () => {
    expect(detail).toContain("Linking.openURL(`tel:${number.replace(/[^\\d+]/g, '')}`).catch(")
  })
})
