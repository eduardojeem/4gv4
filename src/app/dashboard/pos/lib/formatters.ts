/**
 * Utilidades de formateo amigable para el POS y Gestión de Caja
 * Evita mostrar UUIDs o identificadores técnicos a los usuarios.
 */

/**
 * Resuelve el nombre legible de una caja a partir de su ID o nombre.
 */
export function formatRegisterName(
  registerIdOrName?: string | null,
  registers: Array<{ id: string; name: string }> = []
): string {
  if (!registerIdOrName) return 'Caja Principal'
  
  const trimmed = registerIdOrName.trim()
  if (trimmed === 'current' || trimmed.toLowerCase() === 'caja actual') {
    return 'Caja Actual'
  }

  // Buscar en la lista de cajas de la sucursal
  const match = registers.find(r => r.id === trimmed || r.name.toLowerCase() === trimmed.toLowerCase())
  if (match && match.name) {
    return match.name
  }

  // Si es un UUID (longitud >= 30 con guiones), formatear limpiamente
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  if (isUuid) {
    return 'Caja Principal'
  }

  // Si ya es un nombre legible (ej: "Caja 1", "Mostrador")
  return trimmed
}

const GENERIC_USER_NAMES = new Set([
  'usuario',
  'usuario desconocido',
  'usuario no identificado',
  'user',
  'operador',
  'operador de caja',
  'cajero',
  'desconocido',
  'null',
  'undefined'
])

/**
 * Formatea el nombre de un usuario u operador para que no se muestren IDs técnicos ni placeholders genéricos.
 */
export function formatUserLabel(
  userName?: string | null,
  userEmail?: string | null,
  userId?: string | null,
  fallbackName?: string | null
): string {
  const name = (userName || '').trim()
  const email = (userEmail || '').trim()

  if (name.toLowerCase() === 'system' || name.toLowerCase() === 'sistema') {
    return 'Sistema'
  }

  const isNameUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)
  const isGenericName = !name || isNameUuid || GENERIC_USER_NAMES.has(name.toLowerCase())

  // 1. Si tiene un nombre real auténtico (ej: "Juan Pérez", "Eduardo")
  if (name && !isGenericName) {
    if (name.includes('@')) {
      const alias = name.split('@')[0].replace(/[._-]/g, ' ')
      return alias.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
    return name
  }

  // 2. Si tiene correo electrónico
  if (email && email.includes('@')) {
    const alias = email.split('@')[0].replace(/[._-]/g, ' ')
    return alias.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // 3. Si hay un nombre de respaldo (ej. el usuario conectado actualmente)
  if (fallbackName && fallbackName.trim() && !GENERIC_USER_NAMES.has(fallbackName.trim().toLowerCase())) {
    const cleanFallback = fallbackName.trim()
    if (cleanFallback.includes('@')) {
      const alias = cleanFallback.split('@')[0].replace(/[._-]/g, ' ')
      return alias.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }
    return cleanFallback
  }

  return 'Operador Principal'
}

/**
 * Formatea el código de comprobante o venta de forma amigable (ej: "Venta #A4B29F").
 */
export function formatSaleDisplayCode(
  saleCode?: string | null,
  saleId?: string | null
): string {
  if (saleCode && saleCode.trim()) {
    const clean = saleCode.trim()
    return clean.startsWith('V-') || clean.startsWith('#') || clean.toLowerCase().startsWith('venta') 
      ? clean 
      : `#${clean}`
  }

  if (saleId && saleId.trim()) {
    const cleanId = saleId.replace(/-/g, '').slice(0, 6).toUpperCase()
    return `Venta #${cleanId}`
  }

  return 'Venta en mostrador'
}

/**
 * Formatea el concepto o motivo de un evento de caja de forma enriquecida y clara,
 * especialmente para ventas detallando método de pago y referencia.
 */
export function formatEventConcept({
  action,
  details,
  paymentMethod,
  amount,
  formatCurrencyFn
}: {
  action?: string | null
  details?: string | null
  paymentMethod?: string | null
  amount?: number | null
  formatCurrencyFn?: (amount: number) => string
}): string {
  const norm = (action || '').toLowerCase().replace(/_/g, ' ')
  const rawDetails = (details || '').trim()

  const getMethodName = (m?: string | null) => {
    if (!m) return ''
    const normM = m.toLowerCase()
    if (normM === 'cash' || normM === 'efectivo') return 'Efectivo'
    if (normM === 'card' || normM === 'tarjeta') return 'Tarjeta'
    if (normM === 'transfer' || normM === 'transferencia' || normM === 'qr' || normM === 'sipap') return 'Transferencia / QR'
    if (normM === 'mixed' || normM === 'mixto') return 'Pago Mixto'
    return m
  }

  const methodLabel = getMethodName(paymentMethod)

  // 1. VENTAS
  if (norm.includes('sale') || norm.includes('venta')) {
    let cleanCode = ''
    const isDetailsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDetails)

    if (isDetailsUuid) {
      cleanCode = `Venta #${rawDetails.slice(0, 6).toUpperCase()}`
    } else if (rawDetails && rawDetails.toLowerCase() !== 'sale' && rawDetails.toLowerCase() !== 'venta') {
      cleanCode = rawDetails.startsWith('#') || rawDetails.toLowerCase().startsWith('venta') 
        ? rawDetails 
        : `Venta #${rawDetails.toUpperCase()}`
    }
    
    if (cleanCode && methodLabel) {
      return `${cleanCode} • Cobro vía ${methodLabel}`
    }
    if (cleanCode) {
      return cleanCode
    }
    if (methodLabel) {
      return `Venta en mostrador • Cobro vía ${methodLabel}`
    }
    return 'Venta comercial en mostrador'
  }

  // 2. APERTURAS
  if (norm.includes('open') || norm.includes('apertur')) {
    if (amount && amount > 0 && formatCurrencyFn) {
      return `Apertura de turno con fondo inicial: ${formatCurrencyFn(amount)}`
    }
    return rawDetails && rawDetails.toLowerCase() !== 'opening' && rawDetails.toLowerCase() !== 'apertura'
      ? rawDetails
      : 'Apertura de turno de caja'
  }

  // 3. CIERRES
  if (norm.includes('z closure') || norm.includes('cierre z')) {
    return rawDetails && rawDetails.toLowerCase() !== 'z_closure' && rawDetails.toLowerCase() !== 'cierre'
      ? rawDetails
      : 'Cierre Z fiscal definitivo'
  }

  if (norm.includes('clos') || norm.includes('cierre')) {
    return rawDetails && rawDetails.toLowerCase() !== 'closing' && rawDetails.toLowerCase() !== 'cierre'
      ? rawDetails
      : 'Cierre de turno y arqueo de caja'
  }

  // 4. INGRESOS
  if (norm.includes('cash in') || norm.includes('ingreso') || norm.includes('entrad')) {
    if (rawDetails && rawDetails.toLowerCase() !== 'cash_in' && rawDetails.toLowerCase() !== 'ingreso') {
      return `Ingreso de efectivo: ${rawDetails}`
    }
    return 'Ingreso manual de efectivo a caja'
  }

  // 5. EGRESOS / GASTOS
  if (norm.includes('cash out') || norm.includes('egreso') || norm.includes('salid') || norm.includes('retiro')) {
    if (rawDetails && rawDetails.toLowerCase() !== 'cash_out' && rawDetails.toLowerCase() !== 'egreso') {
      return `Retiro / Gasto: ${rawDetails}`
    }
    return 'Salida / Retiro de efectivo autorizado'
  }

  return rawDetails || 'Evento registrado en sistema'
}
