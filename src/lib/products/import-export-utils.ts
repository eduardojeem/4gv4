/**
 * Utility functions for importing and exporting products in multiple formats (Excel, CSV)
 * with smart column mapping, normalization, and validation.
 */

export interface ExportProductItem {
  id?: string
  sku?: string | null
  name: string
  description?: string | null
  brand?: string | null
  category?: { name?: string | null } | string | null
  supplier?: { name?: string | null } | string | null
  purchase_price?: number | null
  sale_price?: number | null
  stock_quantity?: number | null
  min_stock?: number | null
  barcode?: string | null
  unit_measure?: string | null
  is_active?: boolean | null
  created_at?: string | null
}

export interface ImportProductRow {
  name: string
  sku?: string
  description?: string
  brand?: string
  category?: string
  supplier?: string
  purchase_price?: number
  sale_price: number
  stock_quantity: number
  min_stock?: number
  barcode?: string
  unit_measure?: string
  is_active?: boolean
  status?: 'valid' | 'warning' | 'invalid'
  validationErrors?: string[]
  validationWarnings?: string[]
  rawRowIndex: number
}

export interface ParseImportResult {
  fileName: string
  fileType: 'xlsx' | 'xls' | 'csv'
  totalRows: number
  validRows: ImportProductRow[]
  warningRows: ImportProductRow[]
  invalidRows: ImportProductRow[]
  allRows: ImportProductRow[]
  headersFound: string[]
}

/**
 * Normaliza nombres de encabezados quitando tildes, espacios, símbolos y convirtiendo a minúsculas
 */
export function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/**
 * Limpia y parsea números considerando formatos en Guaraníes, dólares o decimales en español
 */
export function parseSmartNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number') return Number.isNaN(value) ? undefined : value

  let str = String(value).trim()
  if (!str) return undefined

  // Quitar símbolos de moneda y espacios
  str = str.replace(/[$€Gs\.\s]/gi, '').trim()

  // Si tiene coma como separador decimal (ej: "1500,50")
  if (str.includes(',')) {
    str = str.replace(',', '.')
  }

  const num = Number(str)
  return Number.isNaN(num) ? undefined : num
}

/**
 * Detecta la columna canónica a partir de variantes comunes de encabezados
 */
export function mapHeaderToField(normalizedKey: string): keyof ImportProductRow | null {
  // Nombre
  if (/^(nombre|name|producto|product|item|articulo|titulo|descripcion_corta)$/.test(normalizedKey)) {
    return 'name'
  }
  // SKU / Código
  if (/^(sku|codigo|cod|code|referencia|ref|codigo_interno|codigo_producto)$/.test(normalizedKey)) {
    return 'sku'
  }
  // Precio de Venta
  if (/^(precio_venta|precio|sale_price|price|pvp|p_venta|precio_publico|valor_venta|selling_price)$/.test(normalizedKey)) {
    return 'sale_price'
  }
  // Precio de Compra / Costo
  if (/^(precio_compra|costo|purchase_price|cost|cost_price|p_compra|precio_costo|valor_compra|costo_compra)$/.test(normalizedKey)) {
    return 'purchase_price'
  }
  // Stock / Existencia / Cantidad
  if (/^(stock|stock_quantity|cantidad|cant|existencia|existencias|qty|inventario|quantity|quantity_ordered|cantidad_pedida)$/.test(normalizedKey)) {
    return 'stock_quantity'
  }
  // Stock Mínimo
  if (/^(stock_minimo|min_stock|minimo|stock_min|alerta_stock)$/.test(normalizedKey)) {
    return 'min_stock'
  }
  // Activo / Inactivo / Estado
  if (/^(activo|active|is_active|estado|status)$/.test(normalizedKey)) {
    return 'is_active'
  }
  // Categoría
  if (/^(categoria|category|rubro|grupo|familia|departamento)$/.test(normalizedKey)) {
    return 'category'
  }
  // Marca
  if (/^(marca|brand|fabricante|linea)$/.test(normalizedKey)) {
    return 'brand'
  }
  // Proveedor
  if (/^(proveedor|supplier|distribuidor|provider|vendor)$/.test(normalizedKey)) {
    return 'supplier'
  }
  // Código de Barras
  if (/^(codigo_barras|codigo_de_barras|barcode|ean|upc|codigo_barra|barras)$/.test(normalizedKey)) {
    return 'barcode'
  }
  // Descripción
  if (/^(descripcion|description|detalle|observaciones|nota|notas)$/.test(normalizedKey)) {
    return 'description'
  }
  // Unidad de Medida
  if (/^(unidad_medida|unidad|unit|unit_measure|medida|um)$/.test(normalizedKey)) {
    return 'unit_measure'
  }

  return null
}

/**
 * Parsea un archivo (.xlsx, .xls o .csv) usando SheetJS de forma nativa
 */
export async function parseImportFile(file: File): Promise<ParseImportResult> {
  const XLSX = await import('xlsx')
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const fileType = (extension === 'xlsx' || extension === 'xls' ? extension : 'csv') as 'xlsx' | 'xls' | 'csv'

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    raw: false,
    cellDates: true,
  })

  // Usar la primera hoja disponible
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas con datos.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rawRows = (XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  }) as Array<Record<string, unknown>>) || []

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo está vacío o no contiene filas de datos.')
  }

  // Detectar y mapear encabezados
  const firstRaw = rawRows[0]
  const rawHeaderKeys = Object.keys(firstRaw)
  const headerFieldMap: Record<string, keyof ImportProductRow> = {}

  for (const rawKey of rawHeaderKeys) {
    const normalized = normalizeHeaderKey(rawKey)
    const field = mapHeaderToField(normalized)
    if (field) {
      headerFieldMap[rawKey] = field
    }
  }

  // Validar si encontramos al menos el nombre
  const hasNameField = Object.values(headerFieldMap).includes('name')
  if (!hasNameField) {
    throw new Error(
      'No se encontró una columna para el nombre del producto (ej: "Nombre", "Producto" o "Name").'
    )
  }

  const allRows: ImportProductRow[] = []
  const validRows: ImportProductRow[] = []
  const warningRows: ImportProductRow[] = []
  const invalidRows: ImportProductRow[] = []

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2 // Fila 1 son encabezados
    const mapped: Partial<ImportProductRow> = {
      rawRowIndex: rowNumber,
    }

    for (const [rawKey, field] of Object.entries(headerFieldMap)) {
      const val = rawRow[rawKey]
      if (val === undefined || val === null || val === '') continue

      if (field === 'sale_price' || field === 'purchase_price' || field === 'stock_quantity' || field === 'min_stock') {
        const num = parseSmartNumber(val)
        if (num !== undefined) {
          (mapped as any)[field] = num
        }
      } else if (field === 'is_active') {
        const s = String(val).toLowerCase().trim()
        mapped.is_active = !(s === 'no' || s === 'false' || s === 'inactivo' || s === '0' || s.startsWith('inactiv'))
      } else {
        (mapped as any)[field] = String(val).trim()
      }
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Validación de Nombre
    const name = mapped.name?.trim() || ''
    if (!name) {
      errors.push('Falta el nombre del producto')
    }

    // Validación de Precio de Venta
    let salePrice = mapped.sale_price
    if (salePrice === undefined || salePrice === null || Number.isNaN(salePrice) || salePrice <= 0) {
      if (mapped.purchase_price !== undefined && mapped.purchase_price > 0) {
        // Si el archivo proviene de una orden de compra o proveedor con solo precio de costo,
        // estimar precio de venta sugerido con margen de ganancia comercial (~40-50%)
        if (mapped.purchase_price < 1000) {
          // En dólares (USD)
          salePrice = Math.round(mapped.purchase_price * 1.5 * 100) / 100
        } else {
          // En guaraníes (PYG) redondeado a miles
          salePrice = Math.round((mapped.purchase_price * 1.4) / 1000) * 1000
        }
        mapped.sale_price = salePrice
        warnings.push(`Precio de venta no especificado (se estimó automáticamente en ${salePrice} a partir del costo)`)
      } else {
        errors.push('Precio de venta inválido o no especificado (debe ser mayor a 0)')
      }
    }

    // Advertencias menores
    if (!mapped.sku) {
      warnings.push('Sin SKU (se generará automáticamente)')
    }
    if (!mapped.category) {
      warnings.push('Sin categoría asignada')
    }
    if (mapped.stock_quantity === undefined) {
      warnings.push('Stock no indicado (se iniciará en 0)')
    }

    let status: 'valid' | 'warning' | 'invalid' = 'valid'
    if (errors.length > 0) {
      status = 'invalid'
    } else if (warnings.length > 0) {
      status = 'warning'
    }

    const finalRow: ImportProductRow = {
      name,
      sku: mapped.sku || undefined,
      description: mapped.description || undefined,
      brand: mapped.brand || undefined,
      category: mapped.category || undefined,
      supplier: mapped.supplier || undefined,
      purchase_price: mapped.purchase_price !== undefined ? mapped.purchase_price : undefined,
      sale_price: salePrice || 0,
      stock_quantity: mapped.stock_quantity !== undefined ? Math.max(0, Math.floor(mapped.stock_quantity)) : 0,
      min_stock: mapped.min_stock !== undefined ? Math.max(0, Math.floor(mapped.min_stock)) : undefined,
      barcode: mapped.barcode || undefined,
      unit_measure: mapped.unit_measure || 'unidad',
      is_active: mapped.is_active !== undefined ? mapped.is_active : true,
      status,
      validationErrors: errors,
      validationWarnings: warnings,
      rawRowIndex: rowNumber,
    }

    allRows.push(finalRow)
    if (status === 'valid') {
      validRows.push(finalRow)
    } else if (status === 'warning') {
      warningRows.push(finalRow)
    } else {
      invalidRows.push(finalRow)
    }
  })

  return {
    fileName: file.name,
    fileType,
    totalRows: allRows.length,
    validRows,
    warningRows,
    invalidRows,
    allRows,
    headersFound: rawHeaderKeys,
  }
}

/**
 * Exporta el catálogo de productos a un archivo Excel (.xlsx) con hojas formateadas
 */
export async function exportCatalogToExcel(
  products: ExportProductItem[],
  options: {
    filename?: string
    canViewCost?: boolean
    branchName?: string | null
  } = {}
) {
  const XLSX = await import('xlsx')
  const { filename = `catalogo_productos_${new Date().toISOString().split('T')[0]}`, canViewCost = true, branchName } = options

  const wb = XLSX.utils.book_new()

  // 1. Hoja de Productos
  const productRows = products.map((p) => {
    const categoryName = typeof p.category === 'object' && p.category ? p.category.name : String(p.category || '')
    const supplierName = typeof p.supplier === 'object' && p.supplier ? p.supplier.name : String(p.supplier || '')
    const stock = Number(p.stock_quantity || 0)
    const salePrice = Number(p.sale_price || 0)
    const costPrice = Number(p.purchase_price || 0)
    const stockValue = stock * salePrice

    const row: Record<string, unknown> = {
      SKU: p.sku || '',
      Nombre: p.name || '',
      Descripción: p.description || '',
      Categoría: categoryName || '',
      Marca: p.brand || '',
      Proveedor: supplierName || '',
    }

    if (canViewCost) {
      row['Precio Compra (Costo)'] = costPrice
      const margin = salePrice - costPrice
      const marginPct = costPrice > 0 ? (margin / costPrice) * 100 : 0
      row['Margen Estimado %'] = Number(marginPct.toFixed(1))
    }

    row['Precio Venta'] = salePrice
    row['Stock Actual'] = stock
    row['Stock Mínimo'] = p.min_stock ?? 0
    row['Valor Total Stock'] = stockValue
    row['Código de Barras'] = p.barcode || ''
    row['Unidad de Medida'] = p.unit_measure || 'unidad'
    row['Estado'] = p.is_active !== false ? 'Activo' : 'Inactivo'

    return row
  })

  const wsProducts = XLSX.utils.json_to_sheet(productRows)

  // Ajuste automático de anchos de columna
  const colWidths = [
    { wch: 16 }, // SKU
    { wch: 32 }, // Nombre
    { wch: 28 }, // Descripción
    { wch: 18 }, // Categoría
    { wch: 16 }, // Marca
    { wch: 20 }, // Proveedor
    ...(canViewCost ? [{ wch: 18 }, { wch: 18 }] : []), // Costo y Margen
    { wch: 16 }, // Precio Venta
    { wch: 14 }, // Stock
    { wch: 14 }, // Stock Mínimo
    { wch: 18 }, // Valor Stock
    { wch: 18 }, // Código Barras
    { wch: 16 }, // Unidad
    { wch: 12 }, // Estado
  ]
  wsProducts['!cols'] = colWidths

  XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos')

  // 2. Hoja de Resumen
  const totalProducts = products.length
  const totalStock = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0), 0)
  const totalValue = products.reduce((sum, p) => sum + Number(p.stock_quantity || 0) * Number(p.sale_price || 0), 0)
  const lowStockCount = products.filter((p) => Number(p.stock_quantity || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.min_stock || 0)).length
  const outOfStockCount = products.filter((p) => Number(p.stock_quantity || 0) <= 0).length

  const summaryData = [
    { Métrica: 'Reporte', Valor: 'Inventario y Catálogo de Productos' },
    { Métrica: 'Fecha de Exportación', Valor: new Date().toLocaleString('es-PY') },
    { Métrica: 'Sucursal / Alcance', Valor: branchName || 'Inventario General' },
    { Métrica: 'Total de Productos Listados', Valor: totalProducts },
    { Métrica: 'Unidades Totales en Existencia', Valor: totalStock },
    { Métrica: 'Valor Estimado de Inventario (Precio Venta)', Valor: totalValue },
    { Métrica: 'Productos con Bajo Stock', Valor: lowStockCount },
    { Métrica: 'Productos Agotados (Sin Existencias)', Valor: outOfStockCount },
  ]

  const wsSummary = XLSX.utils.json_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 32 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  // Guardar archivo
  XLSX.writeFile(wb, `${filename}.xlsx`)
  return { success: true }
}

/**
 * Exporta el catálogo a CSV compatible universal con Excel (UTF-8 con BOM)
 */
export function exportCatalogToCSV(
  products: ExportProductItem[],
  options: {
    filename?: string
    canViewCost?: boolean
  } = {}
) {
  const { filename = `catalogo_productos_${new Date().toISOString().split('T')[0]}`, canViewCost = true } = options

  const headers = [
    'SKU',
    'Nombre',
    'Descripcion',
    'Categoria',
    'Marca',
    'Proveedor',
    ...(canViewCost ? ['Precio_Compra'] : []),
    'Precio_Venta',
    'Stock',
    'Stock_Minimo',
    'Codigo_Barras',
    'Unidad_Medida',
    'Estado',
  ]

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = products.map((p) => {
    const categoryName = typeof p.category === 'object' && p.category ? p.category.name : String(p.category || '')
    const supplierName = typeof p.supplier === 'object' && p.supplier ? p.supplier.name : String(p.supplier || '')

    const row = [
      p.sku || '',
      p.name || '',
      p.description || '',
      categoryName || '',
      p.brand || '',
      supplierName || '',
      ...(canViewCost ? [p.purchase_price ?? 0] : []),
      p.sale_price ?? 0,
      p.stock_quantity ?? 0,
      p.min_stock ?? 0,
      p.barcode || '',
      p.unit_measure || 'unidad',
      p.is_active !== false ? 'Activo' : 'Inactivo',
    ]
    return row.map(escapeCSV).join(',')
  })

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return { success: true }
}

/**
 * Descarga plantilla de ejemplo en Excel (.xlsx) o CSV (.csv)
 */
export async function downloadProductTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const sampleProducts = [
    {
      SKU: 'ACC-001',
      Nombre: 'Cargador Rápido USB-C 20W',
      Descripcion: 'Cargador de pared carga rápida compatible con Android y iPhone',
      Categoria: 'Accesorios',
      Marca: 'Ecopower',
      Precio_Compra: 20000,
      Precio_Venta: 45000,
      Stock: 25,
      Stock_Minimo: 5,
      Codigo_Barras: '7891234567890',
      Unidad_Medida: 'unidad',
    },
    {
      SKU: 'ACC-002',
      Nombre: 'Funda Silicona iPhone 15 Pro',
      Descripcion: 'Funda protectora antishock con interior aterciopelado',
      Categoria: 'Fundas',
      Marca: 'OEM',
      Precio_Compra: 15000,
      Precio_Venta: 35000,
      Stock: 40,
      Stock_Minimo: 8,
      Codigo_Barras: '7891234567891',
      Unidad_Medida: 'unidad',
    },
    {
      SKU: 'REP-003',
      Nombre: 'Módulo Display Samsung A54 Original',
      Descripcion: 'Pantalla AMOLED completa con marco y touch integrado',
      Categoria: 'Repuestos',
      Marca: 'Samsung',
      Precio_Compra: 280000,
      Precio_Venta: 420000,
      Stock: 6,
      Stock_Minimo: 2,
      Codigo_Barras: '7891234567892',
      Unidad_Medida: 'unidad',
    },
  ]

  if (format === 'xlsx') {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sampleProducts)
    ws['!cols'] = [
      { wch: 14 },
      { wch: 36 },
      { wch: 40 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Productos')

    // Hoja explicativa de columnas
    const instructions = [
      { Columna: 'Nombre', Obligatorio: 'SÍ', Descripción: 'Nombre o título principal del producto' },
      { Columna: 'Precio_Venta', Obligatorio: 'SÍ', Descripción: 'Precio de venta al público en moneda local' },
      { Columna: 'SKU', Obligatorio: 'Opcional', Descripción: 'Código único interno (si está vacío, el sistema genera uno)' },
      { Columna: 'Precio_Compra', Obligatorio: 'Opcional', Descripción: 'Costo de adquisición para calcular márgenes' },
      { Columna: 'Stock', Obligatorio: 'Opcional', Descripción: 'Cantidad inicial de unidades físicas (por defecto 0)' },
      { Columna: 'Stock_Minimo', Obligatorio: 'Opcional', Descripción: 'Nivel mínimo para generar alertas de reposición' },
      { Columna: 'Categoria', Obligatorio: 'Opcional', Descripción: 'Nombre de la categoría existente o a asociar' },
      { Columna: 'Marca', Obligatorio: 'Opcional', Descripción: 'Marca o fabricante del producto' },
      { Columna: 'Codigo_Barras', Obligatorio: 'Opcional', Descripción: 'Código EAN / UPC para escáner en punto de venta' },
      { Columna: 'Descripcion', Obligatorio: 'Opcional', Descripción: 'Detalles técnicos o descripción extendida' },
      { Columna: 'Unidad_Medida', Obligatorio: 'Opcional', Descripción: 'unidad, par, metro, kit, etc.' },
    ]
    const wsInstructions = XLSX.utils.json_to_sheet(instructions)
    wsInstructions['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones')

    XLSX.writeFile(wb, 'plantilla_productos.xlsx')
  } else {
    const headers = Object.keys(sampleProducts[0]).join(',')
    const rows = sampleProducts.map((p) => Object.values(p).map((v) => `"${v}"`).join(','))
    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
