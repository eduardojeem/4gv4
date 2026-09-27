export type CheckoutEligibilityInput = {
  itemCount: number
  hasOpenCashSession: boolean
  isProcessing?: boolean
  customerRequired?: boolean
  customerSelected?: boolean
}

export type CheckoutEligibility = {
  canOpen: boolean
  canConfirm: boolean
  reason?: string
}

export function getCheckoutEligibility({
  itemCount,
  hasOpenCashSession,
  isProcessing = false,
  customerRequired = false,
  customerSelected = false,
}: CheckoutEligibilityInput): CheckoutEligibility {
  if (isProcessing) {
    return { canOpen: false, canConfirm: false, reason: 'Esperá a que termine el cobro actual' }
  }
  if (itemCount <= 0) {
    return { canOpen: false, canConfirm: false, reason: 'Agregá productos o una reparación' }
  }
  if (!hasOpenCashSession) {
    return { canOpen: true, canConfirm: false, reason: 'Abrí la caja para continuar' }
  }
  if (customerRequired && !customerSelected) {
    return { canOpen: true, canConfirm: false, reason: 'Seleccioná el cliente' }
  }
  return { canOpen: true, canConfirm: true }
}
