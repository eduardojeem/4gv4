import { describe, expect, it } from 'vitest'
import {
  countRepairLineItems,
  getRepairLinePresentation,
} from './repair-line-presentation'

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

  it('agrupa el material incluido dentro del servicio como un solo item visual', () => {
    expect(getRepairLinePresentation(lines, 0)).toMatchObject({
      displayNumber: 1,
      includedMaterialIndex: 1,
      hidden: false,
    })
    expect(getRepairLinePresentation(lines, 1)).toMatchObject({
      hidden: true,
    })
    expect(getRepairLinePresentation(lines, 2).displayNumber).toBe(2)
    expect(countRepairLineItems(lines)).toBe(3)
  })

  it('mantiene visible un material incluido antiguo que no tiene servicio asociado', () => {
    const orphanMaterial = [{ lineType: 'included_material' as const }]

    expect(getRepairLinePresentation(orphanMaterial, 0)).toMatchObject({
      hidden: false,
      displayNumber: 1,
    })
  })
})
