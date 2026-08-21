import { describe, expect, it } from 'vitest'
import { getRepairLinePresentation } from './repair-line-presentation'

describe('getRepairLinePresentation', () => {
  const lines = [
    { lineType: 'service' as const },
    { lineType: 'included_material' as const },
    { lineType: 'charged_part' as const },
    { lineType: undefined },
  ]

  it('identifica el servicio y su material incluido sin llamarlos repuestos', () => {
    expect(getRepairLinePresentation(lines, 0)).toMatchObject({
      title: 'Servicio',
      nameLabel: 'Nombre del servicio',
      clientPriceLabel: 'Precio del servicio',
    })
    expect(getRepairLinePresentation(lines, 1)).toMatchObject({
      title: 'Material incluido',
      nameLabel: 'Material o insumo',
      clientPriceLabel: 'Adicional al cliente',
    })
  })

  it('numera únicamente los repuestos cobrados, incluyendo registros antiguos', () => {
    expect(getRepairLinePresentation(lines, 2).title).toBe('Repuesto 1')
    expect(getRepairLinePresentation(lines, 3).title).toBe('Repuesto 2')
  })
})
