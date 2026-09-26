import { describe, expect, it } from 'vitest'
import {
  customerSegmentLabel,
  customerTypeKey,
  customerStatusLabel,
  customerTypeLabel,
  orderStatusLabel,
  paymentMethodLabel,
  productVisibilityLabel,
  repairStatusLabel,
} from './labels'

describe('customerSegmentLabel', () => {
  it('traduce el caso reportado: wholesale se veía crudo', () => {
    expect(customerSegmentLabel('wholesale')).toBe('Mayorista')
  })

  it('traduce el resto de los segmentos', () => {
    expect(customerSegmentLabel('regular')).toBe('Particular')
    expect(customerSegmentLabel('business')).toBe('Empresa')
    expect(customerSegmentLabel('vip')).toBe('VIP')
  })

  it('acepta el valor ya en español, que también existe en la base', () => {
    expect(customerSegmentLabel('mayorista')).toBe('Mayorista')
    expect(customerSegmentLabel('empresa')).toBe('Empresa')
  })

  it('cubre los segmentos que solo existen en el formulario de edición', () => {
    // Estos tres no aparecian en las tarjetas, pero el formulario los guarda:
    // sin mapa se mostrarian como "New" y "High value".
    expect(customerSegmentLabel('new')).toBe('Nuevo')
    expect(customerSegmentLabel('high_value')).toBe('Alto valor')
    expect(customerSegmentLabel('low_value')).toBe('Bajo valor')
  })

  it('no distingue mayúsculas ni espacios sobrantes', () => {
    expect(customerSegmentLabel('  WHOLESALE  ')).toBe('Mayorista')
  })
})

describe('customerTypeLabel', () => {
  it('comparte vocabulario con el segmento', () => {
    expect(customerTypeLabel('premium')).toBe('Premium')
    expect(customerTypeLabel('wholesale')).toBe('Mayorista')
  })
})

describe('customerTypeKey', () => {
  it('unifica los sinónimos que la app compara por separado', () => {
    // El formulario guarda 'mayorista' y el cobro comparaba contra 'wholesale':
    // ese cliente se quedaba sin la chapa de Mayorista.
    expect(customerTypeKey('mayorista')).toBe('wholesale')
    expect(customerTypeKey('wholesale')).toBe('wholesale')
    expect(customerTypeKey('empresa')).toBe('business')
    expect(customerTypeKey('individual')).toBe('regular')
  })

  it('deja pasar sin tocar lo que no conoce', () => {
    expect(customerTypeKey('otro')).toBe('otro')
    expect(customerTypeKey(null)).toBe('')
  })
})

describe('customerStatusLabel', () => {
  it('traduce los estados en ambos idiomas', () => {
    expect(customerStatusLabel('active')).toBe('Activo')
    expect(customerStatusLabel('activo')).toBe('Activo')
    expect(customerStatusLabel('inactive')).toBe('Inactivo')
  })
})

describe('paymentMethodLabel', () => {
  it('traduce los medios en inglés', () => {
    expect(paymentMethodLabel('cash')).toBe('Efectivo')
    expect(paymentMethodLabel('card')).toBe('Tarjeta')
    expect(paymentMethodLabel('transfer')).toBe('Transferencia')
    expect(paymentMethodLabel('credit')).toBe('Crédito')
  })

  it('acepta las variantes en español que guarda la misma columna', () => {
    // En esta base conviven 'cash' y 'efectivo' segun el flujo que grabo.
    expect(paymentMethodLabel('efectivo')).toBe('Efectivo')
    expect(paymentMethodLabel('transferencia')).toBe('Transferencia')
  })

  it('traduce los compuestos con guion bajo', () => {
    expect(paymentMethodLabel('bank_transfer')).toBe('Transferencia bancaria')
    expect(paymentMethodLabel('card_terminal')).toBe('Tarjeta (POS)')
  })
})

describe('repairStatusLabel', () => {
  it('agrega tildes a los estados que la base guarda sin ellas', () => {
    expect(repairStatusLabel('diagnostico')).toBe('Diagnóstico')
    expect(repairStatusLabel('reparacion')).toBe('En reparación')
  })

  it('traduce también los equivalentes en inglés de la capa de mapeo', () => {
    expect(repairStatusLabel('completed')).toBe('Listo para entregar')
    expect(repairStatusLabel('delivered')).toBe('Entregado')
  })
})

describe('productVisibilityLabel', () => {
  it('traduce la visibilidad', () => {
    expect(productVisibilityLabel('wholesale')).toBe('Solo mayoristas')
    expect(productVisibilityLabel('hidden')).toBe('Oculto')
    expect(productVisibilityLabel('public')).toBe('Público')
  })
})

describe('orderStatusLabel', () => {
  it('traduce el estado del pedido público', () => {
    expect(orderStatusLabel('PENDING')).toBe('Pendiente')
    expect(orderStatusLabel('SHIPPED')).toBe('Enviado')
    expect(orderStatusLabel('CANCELLED')).toBe('Cancelado')
  })
})

describe('valores desconocidos', () => {
  it('se muestran legibles en vez de crudos', () => {
    // Si mañana aparece un valor nuevo, es preferible "Nuevo estado" a
    // "nuevo_estado" y muchisimo mejor que una celda vacia.
    expect(repairStatusLabel('nuevo_estado')).toBe('Nuevo estado')
    expect(paymentMethodLabel('crypto')).toBe('Crypto')
  })

  it('un valor vacío o nulo devuelve cadena vacía, no "Undefined"', () => {
    expect(customerSegmentLabel(null)).toBe('')
    expect(customerSegmentLabel(undefined)).toBe('')
    expect(customerSegmentLabel('   ')).toBe('')
  })
})
