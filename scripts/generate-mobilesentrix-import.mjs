import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

const rawItems = [
  {
    sku: '107082130503',
    name: 'Pantalla OLED iPhone 15 XO7 Soft',
    originalName: 'OLED Assembly For iPhone 15 (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 15, calidad Aftermarket Pro XO7 Soft de alta fidelidad de color y respuesta táctil',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 58.29,
  },
  {
    sku: '107182127813',
    name: 'Pantalla OLED iPhone 13 XO7 3.0 Soft',
    originalName: 'OLED Assembly For iPhone 13 (Aftermarket Pro: XO7 3.0 Soft)',
    description: 'Pantalla OLED para iPhone 13, calidad Aftermarket Pro XO7 3.0 Soft con excelente brillo y contraste',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 8,
    costUSD: 41.47,
  },
  {
    sku: '107082025696',
    name: 'Auricular con Flex Sensor Proximidad iPhone 12 Pro Max',
    originalName: 'Earpiece Speaker With Proximity Sensor Cable For iPhone 12 Pro Max (Warning: Soldering Required For Face ID Functionality) (Premium)',
    description: 'Auricular superior con cable flex de sensor de proximidad para iPhone 12 Pro Max Premium. Requiere microsoldadura para conservar Face ID',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 10.43,
  },
  {
    sku: '107182127665',
    name: 'Pantalla OLED iPhone 17 Pro Aftermarket Plus Soft 120Hz',
    originalName: 'OLED Assembly Compatible For iPhone 17 Pro (Aftermarket Plus: Soft) (120HZ)',
    description: 'Pantalla OLED compatible con iPhone 17 Pro, Aftermarket Plus Soft, tasa de refresco 120Hz fluida',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 45.98,
  },
  {
    sku: '107182127797',
    name: 'Pantalla OLED iPhone 17 Aftermarket Plus Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 17 (Aftermarket Plus: Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 17, Aftermarket Plus Soft, tasa de refresco 120Hz ProMotion compatible',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 45.98,
  },
  {
    sku: '107182117328',
    name: 'Pantalla OLED iPhone 17 Pro Max Aftermarket Plus Soft 120Hz',
    originalName: 'OLED Assembly Compatible For iPhone 17 Pro Max (Aftermarket Plus: Soft) (120HZ)',
    description: 'Pantalla OLED compatible con iPhone 17 Pro Max, Aftermarket Plus Soft, 120Hz de alta resolución',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 49.59,
  },
  {
    sku: '107282227886',
    name: 'Pantalla OLED iPhone 16 Pro Max Aftermarket Plus Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 16 Pro Max (Aftermarket Plus: Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 16 Pro Max, Aftermarket Plus Soft, 120Hz ProMotion compatible',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 45.01,
  },
  {
    sku: '107182127840',
    name: 'Pantalla OLED iPhone 16 Pro Aftermarket Plus Soft 3.0 120Hz',
    originalName: 'OLED Assembly Compatible For iPhone 16 Pro (Aftermarket Plus: Soft 3.0) (120HZ)',
    description: 'Pantalla OLED compatible con iPhone 16 Pro, Aftermarket Plus Soft 3.0, 120Hz ProMotion',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 1,
    costUSD: 72.07,
  },
  {
    sku: '107183138930',
    name: 'Pantalla OLED iPhone 16 XO7 Soft',
    originalName: 'OLED Assembly For iPhone 16 (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 16, calidad Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 3,
    costUSD: 39.79,
  },
  {
    sku: '107182136582',
    name: 'Pantalla OLED iPhone 15 Pro Max XO7 Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 15 Pro Max (Aftermarket Pro: XO7 Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 15 Pro Max, Aftermarket Pro XO7 Soft, tasa 120Hz de alta definición',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 39.79,
  },
  {
    sku: '107183138478',
    name: 'Pantalla OLED iPhone 15 Pro XO7 Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 15 Pro (Aftermarket Pro: XO7 Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 15 Pro, Aftermarket Pro XO7 Soft, 120Hz de tasa de refresco',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 40.11,
  },
  {
    sku: '107082004816',
    name: 'Pantalla LCD iPhone 11 con Chapa Preinstalada Incell XO7',
    originalName: 'LCD Assembly With Steel Plate Pre-Installed For iPhone 11 (Aftermarket Pro: XO7 / Incell)',
    description: 'Pantalla LCD Incell para iPhone 11 con placa de acero disipadora preinstalada, Aftermarket Pro XO7',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 10,
    costUSD: 16.56,
  },
  {
    sku: '107082145095',
    name: 'Pantalla OLED iPhone 14 Pro Max XO7 Soft',
    originalName: 'OLED Assembly For iPhone 14 Pro Max (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 14 Pro Max, calidad Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 39.79,
  },
  {
    sku: '107183138476',
    name: 'Pantalla OLED iPhone 14 Pro XO7 Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 14 Pro (Aftermarket Pro: XO7 Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 14 Pro, Aftermarket Pro XO7 Soft, 120Hz ProMotion compatible',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 39.79,
  },
  {
    sku: '107082129102',
    name: 'Pantalla OLED iPhone 14 XO7 Soft',
    originalName: 'OLED Assembly For iPhone 14 (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 14, Aftermarket Pro XO7 Soft con excelente calibración de color',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 4,
    costUSD: 37.03,
  },
  {
    sku: '107082145094',
    name: 'Pantalla OLED iPhone 13 Pro Max XO7 Soft',
    originalName: 'OLED Assembly For iPhone 13 Pro Max (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 13 Pro Max, Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 38.05,
  },
  {
    sku: '107183138477',
    name: 'Pantalla OLED iPhone 13 Pro XO7 Soft 120Hz',
    originalName: 'OLED Assembly For iPhone 13 Pro (Aftermarket Pro: XO7 Soft) (120HZ)',
    description: 'Pantalla OLED para iPhone 13 Pro, Aftermarket Pro XO7 Soft, 120Hz ProMotion',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 4,
    costUSD: 39.35,
  },
  {
    sku: '107082082903',
    name: 'Pantalla OLED iPhone 12 Pro Max XO7 Soft',
    originalName: 'OLED Assembly For iPhone 12 Pro Max (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 12 Pro Max, Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 37.42,
  },
  {
    sku: '107082069210',
    name: 'Pantalla OLED iPhone 11 Pro Max XO7 Soft',
    originalName: 'OLED Assembly For iPhone 11 Pro Max (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 11 Pro Max, calidad Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 2,
    costUSD: 33.45,
  },
  {
    sku: '107082082704',
    name: 'Pantalla OLED iPhone 12 / 12 Pro XO7 Soft',
    originalName: 'OLED Assembly For iPhone 12 / 12 Pro (Aftermarket Pro: XO7 Soft)',
    description: 'Pantalla OLED para iPhone 12 y iPhone 12 Pro, Aftermarket Pro XO7 Soft',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 5,
    costUSD: 34.71,
  },
  {
    sku: '107182127808',
    name: 'Pantalla OLED iPhone 12 / 12 Pro XO7 3.0 Soft',
    originalName: 'OLED Assembly For iPhone 12 / 12 Pro (Aftermarket Pro: XO7 3.0 Soft)',
    description: 'Pantalla OLED para iPhone 12 y iPhone 12 Pro, Aftermarket Pro XO7 versión 3.0 Soft mejorada',
    category: 'Pantallas y Repuestos',
    brand: 'XO7',
    supplier: 'MobileSentrix',
    stock: 5,
    costUSD: 38.77,
  },
]

// Tipo de cambio referencial a Guaraníes (1 USD = 7.800 Gs)
const EXCHANGE_RATE = 7800

// 1. Versión en Guaraníes (PYG) - Lista para importar en 4G Celulares
const rowsPYG = rawItems.map((item) => {
  const costGs = Math.round((item.costUSD * EXCHANGE_RATE) / 1000) * 1000
  // Margen de ganancia comercial del ~45% redondeado a 10.000 Gs
  const saleGs = Math.round((costGs * 1.45) / 10000) * 10000

  return {
    sku: item.sku,
    nombre: item.name,
    descripcion: item.description,
    categoria: item.category,
    marca: item.brand,
    proveedor: item.supplier,
    precio_compra: costGs,
    precio_venta: saleGs,
    stock: item.stock,
    stock_minimo: 1,
    codigo_barras: item.sku,
    unidad_medida: 'unidad',
    activo: 'No',
  }
})

// 2. Versión en Dólares (USD) - Con valores exactos de MobileSentrix
const rowsUSD = rawItems.map((item) => {
  const saleUSD = Math.round(item.costUSD * 1.45 * 100) / 100

  return {
    sku: item.sku,
    nombre: item.originalName,
    descripcion: item.description,
    categoria: item.category,
    marca: item.brand,
    proveedor: item.supplier,
    precio_compra: item.costUSD,
    precio_venta: saleUSD,
    stock: item.stock,
    stock_minimo: 1,
    codigo_barras: item.sku,
    unidad_medida: 'unidad',
    activo: 'No',
  }
})

function writeFiles(rows, baseName) {
  // Generar CSV
  const headers = Object.keys(rows[0])
  const csvLines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h]
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val ?? ''
    })
    csvLines.push(values.join(','))
  }
  const csvContent = '\uFEFF' + csvLines.join('\r\n')

  fs.writeFileSync(`${baseName}.csv`, csvContent, 'utf8')
  fs.writeFileSync(`public/${baseName}.csv`, csvContent, 'utf8')

  // Generar Excel (.xlsx)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 18 }, // sku
    { wch: 45 }, // nombre
    { wch: 60 }, // descripcion
    { wch: 22 }, // categoria
    { wch: 12 }, // marca
    { wch: 15 }, // proveedor
    { wch: 16 }, // precio_compra
    { wch: 16 }, // precio_venta
    { wch: 8 },  // stock
    { wch: 12 }, // stock_minimo
    { wch: 18 }, // codigo_barras
    { wch: 14 }, // unidad_medida
    { wch: 8 },  // activo
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  fs.writeFileSync(`${baseName}.xlsx`, xlsxBuffer)
  fs.writeFileSync(`public/${baseName}.xlsx`, xlsxBuffer)

  console.log(`Archivos generados: ${baseName}.csv y ${baseName}.xlsx (en raíz y public/)`)
}

writeFiles(rowsPYG, 'productos_mobilesentrix_pyg')
writeFiles(rowsUSD, 'productos_mobilesentrix_usd')
console.log('¡Total 21 productos procesados con éxito en ambas monedas!')
