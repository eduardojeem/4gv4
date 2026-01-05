'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { PaymentSplit } from '../types'

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
  splitAmount: number
  setSplitAmount: (amount: number) => void
  notes: string
  setNotes: (notes: string) => void
  discount: number
  setDiscount: (discount: number) => void

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
  const [splitAmount, setSplitAmount] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState<number>(0)
  
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplit[]>([])

  const addPaymentSplit = useCallback((method: string, amount: number, reference?: string) => {
    setPaymentSplit(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        method: method as any,
        amount,
        reference,
        cardLast4: method === 'card' && cardNumber ? cardNumber.slice(-4) : undefined
      }
    ])
  }, [cardNumber])

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
    setSplitAmount(0)
    setNotes('')
    setDiscount(0)
    setPaymentSplit([])
  }, [])

  return (
    <CheckoutContext.Provider value={{
      isCheckoutOpen,
      setIsCheckoutOpen,
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
      splitAmount,
      setSplitAmount,
      notes,
      setNotes,
      discount,
      setDiscount,
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
