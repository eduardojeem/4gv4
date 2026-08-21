type RepairLineType = 'service' | 'included_material' | 'charged_part'

type RepairLine = {
  lineType?: RepairLineType
}

export function getRepairLinePresentation(lines: RepairLine[], index: number) {
  const lineType = lines[index]?.lineType ?? 'charged_part'

  if (lineType === 'service') {
    return {
      lineType,
      title: 'Servicio',
      nameLabel: 'Nombre del servicio',
      clientPriceLabel: 'Precio del servicio',
    }
  }

  if (lineType === 'included_material') {
    return {
      lineType,
      title: 'Material incluido',
      nameLabel: 'Material o insumo',
      clientPriceLabel: 'Adicional al cliente',
    }
  }

  const partNumber = lines
    .slice(0, index + 1)
    .filter((line) => !line.lineType || line.lineType === 'charged_part')
    .length

  return {
    lineType,
    title: `Repuesto ${partNumber}`,
    nameLabel: 'Nombre del repuesto',
    clientPriceLabel: 'Precio al cliente',
  }
}
