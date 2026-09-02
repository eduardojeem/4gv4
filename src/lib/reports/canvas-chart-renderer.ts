// ── Motor de Renderizado de Gráficos en Alta Resolución para Reportes PDF ─────
// Genera imágenes PNG nítidas a 2x Retina independientes del DOM y de pestañas inactivas.

const PALETTE = [
  '#2563EB', '#10B981', '#7C3AED', '#F59E0B', '#EC4899', 
  '#06B6D4', '#84CC16', '#6366F1', '#14B8A6', '#F97316'
]

function createHiDPICanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number } {
  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  return { canvas, ctx, scale }
}

const formatGs = (v: number): string => {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M Gs.`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M Gs.`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k Gs.`
  return `${Math.round(v)} Gs.`
}

// ── 1. GRÁFICO DE ÁREA Y LÍNEA (Evolución temporal) ───────────────────────────
export function renderAreaChartCanvas(
  title: string,
  data: Array<{ label: string; value: number }>,
  options: {
    lineColor?: string
    fillColor?: string
    formatValue?: (v: number) => string
    width?: number
    height?: number
  } = {}
): string {
  const width = options.width || 760
  const height = options.height || 260
  const { canvas, ctx } = createHiDPICanvas(width, height)
  const formatVal = options.formatValue || formatGs
  const lineColor = options.lineColor || '#2563eb'
  const fillColor = options.fillColor || '#3b82f6'

  // Fondo blanco con borde suave
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, width, height)

  // Título del gráfico
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, 24, 28)

  if (!data || data.length === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sin datos registrados en el período', width / 2, height / 2)
    return canvas.toDataURL('image/png', 0.95)
  }

  const padLeft = 80
  const padRight = 30
  const padTop = 52
  const padBottom = 38
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const maxVal = Math.max(...data.map(d => d.value), 1)
  const yTicks = 4
  const stepVal = maxVal / yTicks

  // Ejes y cuadrícula horizontal
  ctx.strokeStyle = '#f1f5f9'
  ctx.lineWidth = 1
  ctx.fillStyle = '#64748b'
  ctx.font = '10px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'right'

  for (let i = 0; i <= yTicks; i++) {
    const val = stepVal * i
    const y = padTop + chartH - (i * (chartH / yTicks))

    ctx.beginPath()
    ctx.moveTo(padLeft, y)
    ctx.lineTo(width - padRight, y)
    ctx.stroke()

    ctx.fillText(formatVal(val), padLeft - 10, y + 3.5)
  }

  // Puntos calculados
  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(1, data.length - 1)) * chartW
    const y = padTop + chartH - (d.value / maxVal) * chartH
    return { x, y, label: d.label, value: d.value }
  })

  // Gradiente de relleno
  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH)
  grad.addColorStop(0, `${fillColor}40`)
  grad.addColorStop(1, `${fillColor}05`)

  ctx.beginPath()
  ctx.moveTo(points[0].x, padTop + chartH)
  points.forEach((p) => ctx.lineTo(p.x, p.y))
  ctx.lineTo(points[points.length - 1].x, padTop + chartH)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Línea principal
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Puntos individuales
  points.forEach((p) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = lineColor
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })

  // Etiquetas eje X (espaciadas para no solaparse)
  ctx.fillStyle = '#64748b'
  ctx.font = '10px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  const maxLabels = 8
  const stepX = Math.max(1, Math.ceil(data.length / maxLabels))

  for (let i = 0; i < points.length; i += stepX) {
    const p = points[i]
    ctx.fillText(p.label, p.x, height - 12)
  }

  return canvas.toDataURL('image/png', 0.95)
}

// ── 2. GRÁFICO DE BARRAS HORIZONTALES (Ranking de Productos) ───────────────────
export function renderBarChartCanvas(
  title: string,
  data: Array<{ label: string; value: number }>,
  options: {
    barColor?: string
    formatValue?: (v: number) => string
    width?: number
    height?: number
  } = {}
): string {
  const width = options.width || 760
  const height = options.height || Math.max(260, (data.length * 28) + 70)
  const { canvas, ctx } = createHiDPICanvas(width, height)
  const formatVal = options.formatValue || formatGs
  const barColor = options.barColor || '#059669'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, width, height)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, 24, 28)

  if (!data || data.length === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sin productos registrados', width / 2, height / 2)
    return canvas.toDataURL('image/png', 0.95)
  }

  const items = data.slice(0, 10)
  const maxVal = Math.max(...items.map(d => d.value), 1)

  const padLeft = 210
  const padRight = 110
  const padTop = 48
  const chartW = width - padLeft - padRight
  const itemH = (height - padTop - 20) / items.length
  const barH = Math.min(18, itemH * 0.65)

  items.forEach((item, idx) => {
    const y = padTop + idx * itemH + (itemH - barH) / 2
    const bW = Math.max(4, (item.value / maxVal) * chartW)

    // Etiqueta del producto
    ctx.fillStyle = '#1e293b'
    ctx.font = 'bold 10px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'right'
    const cleanLabel = item.label.length > 28 ? `${item.label.slice(0, 26)}...` : item.label
    ctx.fillText(`#${idx + 1} ${cleanLabel}`, padLeft - 14, y + barH - 4)

    // Barra de fondo gris
    ctx.fillStyle = '#f1f5f9'
    ctx.beginPath()
    ctx.roundRect(padLeft, y, chartW, barH, 4)
    ctx.fill()

    // Barra de valor
    ctx.fillStyle = barColor
    ctx.beginPath()
    ctx.roundRect(padLeft, y, bW, barH, 4)
    ctx.fill()

    // Valor a la derecha
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 10px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(formatVal(item.value), padLeft + bW + 8, y + barH - 4)
  })

  return canvas.toDataURL('image/png', 0.95)
}

// ── 3. GRÁFICO CIRCULAR / DONUT (Categorías y Estados) ─────────────────────────
export function renderDonutChartCanvas(
  title: string,
  data: Array<{ label: string; value: number; color?: string }>,
  options: {
    formatValue?: (v: number) => string
    width?: number
    height?: number
  } = {}
): string {
  const width = options.width || 760
  const height = options.height || 260
  const { canvas, ctx } = createHiDPICanvas(width, height)
  const formatVal = options.formatValue || formatGs

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.strokeRect(0, 0, width, height)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 13px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, 24, 28)

  const items = data.filter(d => d.value > 0)
  const total = items.reduce((sum, d) => sum + d.value, 0)

  if (items.length === 0 || total === 0) {
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Sin datos registrados', width / 2, height / 2)
    return canvas.toDataURL('image/png', 0.95)
  }

  const cx = 170
  const cy = 145
  const outerR = 78
  const innerR = 46

  let currentAngle = -Math.PI / 2

  items.forEach((item, idx) => {
    const sliceAngle = (item.value / total) * Math.PI * 2
    const sliceColor = item.color || PALETTE[idx % PALETTE.length]

    ctx.beginPath()
    ctx.arc(cx, cy, outerR, currentAngle, currentAngle + sliceAngle)
    ctx.arc(cx, cy, innerR, currentAngle + sliceAngle, currentAngle, true)
    ctx.closePath()

    ctx.fillStyle = sliceColor
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()

    currentAngle += sliceAngle
  })

  // Texto central
  ctx.fillStyle = '#64748b'
  ctx.font = '9px Helvetica, Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TOTAL', cx, cy - 6)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 11px Helvetica, Arial, sans-serif'
  ctx.fillText(formatVal(total), cx, cy + 10)

  // Leyenda a la derecha
  const legendX = 330
  const legendStartY = 58
  const maxLegend = Math.min(items.length, 7)
  const legendSpacing = (height - legendStartY - 16) / maxLegend

  items.slice(0, maxLegend).forEach((item, idx) => {
    const y = legendStartY + idx * legendSpacing
    const pct = ((item.value / total) * 100).toFixed(1)
    const color = item.color || PALETTE[idx % PALETTE.length]

    // Cuadrito de color
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(legendX, y, 11, 11, 2)
    ctx.fill()

    // Nombre y porcentaje
    ctx.fillStyle = '#1e293b'
    ctx.font = '10px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'left'
    const nameStr = item.label.length > 25 ? `${item.label.slice(0, 23)}...` : item.label
    ctx.fillText(nameStr, legendX + 20, y + 9)

    // Valor y %
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 10px Helvetica, Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${formatVal(item.value)} (${pct}%)`, width - 36, y + 9)
  })

  return canvas.toDataURL('image/png', 0.95)
}
