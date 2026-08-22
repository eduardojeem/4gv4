type RepairLineType = 'service' | 'included_material' | 'charged_part'

type RepairLine = {
  lineType?: RepairLineType
}

function normalizedType(line?: RepairLine): RepairLineType {
  return line?.lineType ?? 'charged_part'
}

function isGroupedMaterial(lines: RepairLine[], index: number) {
  return normalizedType(lines[index]) === 'included_material' &&
    normalizedType(lines[index - 1]) === 'service'
}

export function countRepairLineItems(lines: RepairLine[]) {
  return lines.filter((_, index) => !isGroupedMaterial(lines, index)).length
}

export function getRepairLinePresentation(lines: RepairLine[], index: number) {
  const lineType = normalizedType(lines[index])
  const hidden = isGroupedMaterial(lines, index)
  const displayNumber = lines
    .slice(0, index + 1)
    .filter((_, currentIndex) => !isGroupedMaterial(lines, currentIndex))
    .length

  if (lineType === 'service') {
    return {
      lineType,
      hidden,
      displayNumber,
      includedMaterialIndex: normalizedType(lines[index + 1]) === 'included_material' ? index + 1 : null,
      title: 'Servicio',
      nameLabel: 'Nombre del servicio',
      clientPriceLabel: 'Precio del servicio',
    }
  }

  if (lineType === 'included_material') {
    return {
      lineType,
      hidden,
      displayNumber,
      includedMaterialIndex: null,
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
    hidden,
    displayNumber,
    includedMaterialIndex: null,
    title: `Repuesto ${partNumber}`,
    nameLabel: 'Nombre del repuesto',
    clientPriceLabel: 'Precio al cliente',
  }
}
