export type CreditEligibilityId = 'customer' | 'credit_line' | 'credit_capacity' | 'stock' | 'register'

export type CreditEligibilityItem = {
  id: CreditEligibilityId
  label: string
  met: boolean
  detail: string
}

type CreditEligibilityInput = {
  hasCustomer: boolean
  hasCreditLine: boolean
  availableCredit: number
  financedTotal: number
  stock: number
  quantity: number
  isRegisterOpen: boolean
}

export function buildCreditEligibility(input: CreditEligibilityInput): CreditEligibilityItem[] {
  return [
    {
      id: 'customer',
      label: 'Cliente seleccionado',
      met: input.hasCustomer,
      detail: input.hasCustomer ? 'Cliente listo' : 'Seleccionar un cliente',
    },
    {
      id: 'credit_line',
      label: 'Línea de crédito',
      met: input.hasCreditLine,
      detail: input.hasCreditLine ? 'Línea habilitada' : 'Asignar una línea de crédito',
    },
    {
      id: 'credit_capacity',
      label: 'Crédito disponible',
      met: input.hasCreditLine && input.availableCredit >= input.financedTotal,
      detail: input.availableCredit >= input.financedTotal
        ? 'Capacidad suficiente'
        : 'El disponible no cubre el total financiado',
    },
    {
      id: 'stock',
      label: 'Stock disponible',
      met: input.quantity > 0 && input.stock >= input.quantity,
      detail: input.stock >= input.quantity ? 'Cantidad disponible' : 'Stock insuficiente',
    },
    {
      id: 'register',
      label: 'Caja abierta',
      met: input.isRegisterOpen,
      detail: input.isRegisterOpen ? 'Caja lista para cobrar' : 'Abrir caja antes de confirmar',
    },
  ]
}
