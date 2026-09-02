'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { PaymentSplit } from '../types'
import type { CreditTerms } from '../components/checkout/CreditStatusPanel'
import { creditBusinessDate } from '@/lib/credits/installments'

const DEFAULT_CREDIT_TERMS: CreditTerms = { count: 1, frequency: 'monthly', interestRate: 0, firstInstallmentTiming: 'at_start' }

export type CreditPlanSuggestion = {
  productId: string
  productName: string
  count: number
  interestRate: number
  frequency: 'monthly'
}

interface CheckoutContextType {
  // Modal State
  isCheckoutOpen: boolean
  setIsCheckoutOpen: (isOpen: boolean) => void

  // Payment State
  paymentStatus: 'idle' | 'processing' | 'success' | 'failed'
  setPaymentStatus: (status: 'idle' | 'processing' | 'success' | 'failed') => void
  paymentError: string
  setPaymentError: (error: string) => void
  
  // Payment Methods State
  paymentMethod: string
  setPaymentMethod: (method: string) => void
  isMixedPayment: boolean
  setIsMixedPayment: (isMixed: boolean) => void
  
  // Input Values
  cashReceived: number
  setCashReceived: (amount: number) => void
  cardNumber: string
  setCardNumber: (number: string) => void
  transferReference: string
  setTransferReference: (ref: string) => void
  electronicProvider: string
  setElectronicProvider: (provider: string) => void
  electronicInstitution: string
  setElectronicInstitution: (institution: string) => void
  electronicChannel: 'card_terminal' | 'bank_transfer' | 'qr'
  setElectronicChannel: (channel: 'card_terminal' | 'bank_transfer' | 'qr') => void
  terminalId: string
  setTerminalId: (terminalId: string) => void
  splitAmount: number
  setSplitAmount: (amount: number) => void
  notes: string
  setNotes: (notes: string) => void
  discount: number
  setDiscount: (discount: number) => void

  // Saldo a favor del cliente aplicado a esta venta. No es un descuento: la
  // venta vale lo mismo, cambia con que se paga.
  storeCreditApplied: number
  setStoreCreditApplied: (amount: number) => void

  // Términos de la venta a crédito (cuotas / frecuencia / interés)
  creditTerms: CreditTerms
  setCreditTerms: (terms: CreditTerms) => void
  creditPlanSuggestion: CreditPlanSuggestion | null
  applyProductCreditSuggestion: (suggestion: CreditPlanSuggestion) => void

  // Split Payments
  paymentSplit: PaymentSplit[]
  setPaymentSplit: (splits: PaymentSplit[]) => void
  addPaymentSplit: (method: string, amount: number, reference?: string) => void
  removePaymentSplit: (id: string) => void
  
  // Helpers
  resetCheckoutState: () => void
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined)

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle')
  const [paymentError, setPaymentError] = useState('')
  
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [isMixedPayment, setIsMixedPayment] = useState(false)
  
  const [cashReceived, setCashReceived] = useState<number>(0)
  const [cardNumber, setCardNumber] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [electronicProvider, setElectronicProvider] = useState('')
  const [electronicInstitution, setElectronicInstitution] = useState('')
  const [electronicChannel, setElectronicChannel] = useState<'card_terminal' | 'bank_transfer' | 'qr'>('bank_transfer')
  const [terminalId, setTerminalId] = useState('')
  const [splitAmount, setSplitAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState<number>(0)
  const [storeCreditApplied, setStoreCreditApplied] = useState<number>(0)
  const [creditTerms, setCreditTerms] = useState<CreditTerms>(() => ({ ...DEFAULT_CREDIT_TERMS, startDate: creditBusinessDate() }))
  const [creditPlanSuggestion, setCreditPlanSuggestion] = useState<CreditPlanSuggestion | null>(null)

  const handleCheckoutOpenChange = useCallback((open: boolean) => {
    if (open) {
      const startDate = creditBusinessDate()
      setCreditTerms(previous => previous.startDate === startDate ? previous : { ...previous, startDate })
    }
    setIsCheckoutOpen(open)
  }, [])

  const applyProductCreditSuggestion = useCallback((suggestion: CreditPlanSuggestion) => {
    setCreditPlanSuggestion(suggestion)
    setCreditTerms(previous => ({
      ...previous,
      count: suggestion.count,
      interestRate: suggestion.interestRate,
      frequency: suggestion.frequency,
    }))
  }, [])

  const [paymentSplit, setPaymentSplit] = useState<PaymentSplit[]>([])

  const addPaymentSplit = useCallback((method: string, amount: number, reference?: string) => {
    setPaymentSplit(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: method as PaymentSplit['method'],
        amount,
        reference,
        cardLast4: method === 'card' && cardNumber ? cardNumber.slice(-4) : undefined,
        provider: electronicProvider || undefined,
        institution: electronicInstitution || undefined,
        channel: method === 'card' ? 'card_terminal' : method === 'transfer' ? electronicChannel : undefined,
        terminalId: method === 'card' ? terminalId || undefined : undefined,
      }
    ])
  }, [cardNumber, electronicChannel, electronicInstitution, electronicProvider, terminalId])

  const removePaymentSplit = useCallback((id: string) => {
    setPaymentSplit(prev => prev.filter(p => p.id !== id))
  }, [])

  const resetCheckoutState = useCallback(() => {
    setPaymentStatus('idle')
    setPaymentError('')
    setPaymentMethod('cash')
    setIsMixedPayment(false)
    setCashReceived(0)
    setCardNumber('')
    setTransferReference('')
    setElectronicProvider('')
    setElectronicInstitution('')
    setElectronicChannel('bank_transfer')
    setTerminalId('')
    setSplitAmount(0)
    setNotes('')
    setDiscount(0)
    setStoreCreditApplied(0)
    setCreditTerms({ ...DEFAULT_CREDIT_TERMS, startDate: creditBusinessDate() })
    setCreditPlanSuggestion(null)
    setPaymentSplit([])
  }, [])

  return (
    <CheckoutContext.Provider value={{
      isCheckoutOpen,
      setIsCheckoutOpen: handleCheckoutOpenChange,
      paymentStatus,
      setPaymentStatus,
      paymentError,
      setPaymentError,
      paymentMethod,
      setPaymentMethod,
      isMixedPayment,
      setIsMixedPayment,
      cashReceived,
      setCashReceived,
      cardNumber,
      setCardNumber,
      transferReference,
      setTransferReference,
      electronicProvider,
      setElectronicProvider,
      electronicInstitution,
      setElectronicInstitution,
      electronicChannel,
      setElectronicChannel,
      terminalId,
      setTerminalId,
      splitAmount,
      setSplitAmount,
      notes,
      setNotes,
      discount,
      setDiscount,
      storeCreditApplied,
      setStoreCreditApplied,
      creditTerms,
      setCreditTerms,
      creditPlanSuggestion,
      applyProductCreditSuggestion,
      paymentSplit,
      setPaymentSplit,
      addPaymentSplit,
      removePaymentSplit,
      resetCheckoutState
    }}>
      {children}
    </CheckoutContext.Provider>
  )
}

export function useCheckout() {
  const context = useContext(CheckoutContext)
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider')
  }
  return context
}
