import React from 'react'
import { createClient } from '@supabase/supabase-js'

// Interfaces para procesadores de pago
export interface PaymentMethod {
  id: string
  type: 'credit_card' | 'debit_card' | 'bank_transfer' | 'digital_wallet' | 'cash'
  provider: 'stripe' | 'paypal' | 'square' | 'mercadopago' | 'wompi' | 'payu'
  details: {
    last4?: string
    brand?: string
    expiryMonth?: number
    expiryYear?: number
    holderName?: string
    email?: string
    phone?: string
  }
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PaymentTransaction {
  id: string
  orderId: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
  paymentMethodId: string
  provider: string
  providerTransactionId?: string
  description?: string
  metadata?: Record<string, unknown>
  fees?: {
    processingFee: number
    platformFee: number
    totalFees: number
  }
  refunds?: PaymentRefund[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface PaymentRefund {
  id: string
  transactionId: string
  amount: number
  reason: string
  status: 'pending' | 'completed' | 'failed'
  providerRefundId?: string
  createdAt: Date
  completedAt?: Date
}

export interface PaymentConfig {
  provider: string
  isActive: boolean
  credentials: {
    publicKey?: string
    secretKey?: string
    merchantId?: string
    apiKey?: string
    webhookSecret?: string
  }
  settings: {
    currency: string
    acceptedPaymentMethods: string[]
    minimumAmount: number
    maximumAmount: number
    autoCapture: boolean
    webhookUrl?: string
  }
  fees: {
    fixedFee: number
    percentageFee: number
    internationalFee?: number
  }
}

export interface PaymentWebhook {
  id: string
  provider: string
  eventType: string
  data: Record<string, unknown>
  signature?: string
  processed: boolean
  processedAt?: Date
  createdAt: Date
}

// Clase base para procesadores de pago
export abstract class PaymentProcessor {
  protected config: PaymentConfig
  protected supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  constructor(config: PaymentConfig) {
    this.config = config
  }

  abstract processPayment(transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction>
  abstract refundPayment(transactionId: string, amount: number, reason: string): Promise<PaymentRefund>
  abstract getTransactionStatus(providerTransactionId: string): Promise<PaymentTransaction['status']>
  abstract validateWebhook(payload: string, signature: string): boolean
  abstract processWebhook(webhook: PaymentWebhook): Promise<void>

  // Métodos comunes
  async saveTransaction(transaction: PaymentTransaction): Promise<void> {
    const { error } = await this.supabase
      .from('payment_transactions')
      .insert(transaction)

    if (error) throw error
  }

  async updateTransaction(id: string, updates: Partial<PaymentTransaction>): Promise<void> {
    const { error } = await this.supabase
      .from('payment_transactions')
      .update({ ...updates, updatedAt: new Date() })
      .eq('id', id)

    if (error) throw error
  }

  async getTransaction(id: string): Promise<PaymentTransaction | null> {
    const { data, error } = await this.supabase
      .from('payment_transactions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data
  }

  calculateFees(amount: number): { processingFee: number; platformFee: number; totalFees: number } {
    const processingFee = this.config.fees.fixedFee + (amount * this.config.fees.percentageFee / 100)
    const platformFee = 0 // Configurar según necesidades
    return {
      processingFee,
      platformFee,
      totalFees: processingFee + platformFee
    }
  }
}

// Implementación para Stripe
export class StripeProcessor extends PaymentProcessor {
  private stripe: unknown

  constructor(config: PaymentConfig) {
    super(config)
    // En un entorno real, inicializar Stripe SDK
    // this.stripe = new Stripe(config.credentials.secretKey)
  }

  async processPayment(transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction> {
    try {
      // Simulación de procesamiento con Stripe
      const fees = this.calculateFees(transaction.amount)
      
      const paymentTransaction: PaymentTransaction = {
        ...transaction,
        id: `stripe_${Date.now()}`,
        status: 'processing',
        providerTransactionId: `pi_${Math.random().toString(36).substr(2, 9)}`,
        fees,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Simular llamada a Stripe API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Actualizar estado según respuesta
      paymentTransaction.status = Math.random() > 0.1 ? 'completed' : 'failed'
      if (paymentTransaction.status === 'completed') {
        paymentTransaction.completedAt = new Date()
      }

      await this.saveTransaction(paymentTransaction)
      return paymentTransaction

    } catch (error) {
      throw new Error(`Error processing Stripe payment: ${error}`)
    }
  }

  async refundPayment(transactionId: string, amount: number, reason: string): Promise<PaymentRefund> {
    try {
      const refund: PaymentRefund = {
        id: `re_${Date.now()}`,
        transactionId,
        amount,
        reason,
        status: 'pending',
        providerRefundId: `re_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date()
      }

      // Simular llamada a Stripe API
      await new Promise(resolve => setTimeout(resolve, 500))
      
      refund.status = 'completed'
      refund.completedAt = new Date()

      return refund

    } catch (error) {
      throw new Error(`Error processing Stripe refund: ${error}`)
    }
  }

  async getTransactionStatus(providerTransactionId: string): Promise<PaymentTransaction['status']> {
    // Simular consulta a Stripe
    await new Promise(resolve => setTimeout(resolve, 200))
    return 'completed'
  }

  validateWebhook(payload: string, signature: string): boolean {
    // Implementar validación de webhook de Stripe
    return true
  }

  async processWebhook(webhook: PaymentWebhook): Promise<void> {
    switch (webhook.eventType) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(webhook.data)
        break
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(webhook.data)
        break
      case 'charge.dispute.created':
        await this.handleDispute(webhook.data)
        break
    }
  }

  private async handlePaymentSuccess(data: Record<string, unknown>): Promise<void> {
    const metadata = data.metadata as Record<string, unknown> | undefined
    const orderId = metadata?.orderId as string | undefined
    if (orderId) {
      const transaction = await this.getTransaction(orderId)
      if (transaction) {
        await this.updateTransaction(transaction.id, {
          status: 'completed',
          completedAt: new Date()
        })
      }
    }
  }

  private async handlePaymentFailure(data: Record<string, unknown>): Promise<void> {
    const metadata = data.metadata as Record<string, unknown> | undefined
    const orderId = metadata?.orderId as string | undefined
    if (orderId) {
      const transaction = await this.getTransaction(orderId)
      if (transaction) {
        await this.updateTransaction(transaction.id, {
          status: 'failed'
        })
      }
    }
  }

  private async handleDispute(data: Record<string, unknown>): Promise<void> {
    // Manejar disputas
    console.log('Dispute created:', data)
  }
}

// Implementación para PayPal
export class PayPalProcessor extends PaymentProcessor {
  async processPayment(transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction> {
    try {
      const fees = this.calculateFees(transaction.amount)
      
      const paymentTransaction: PaymentTransaction = {
        ...transaction,
        id: `paypal_${Date.now()}`,
        status: 'processing',
        providerTransactionId: `PAYID-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        fees,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Simular llamada a PayPal API
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      paymentTransaction.status = Math.random() > 0.05 ? 'completed' : 'failed'
      if (paymentTransaction.status === 'completed') {
        paymentTransaction.completedAt = new Date()
      }

      await this.saveTransaction(paymentTransaction)
      return paymentTransaction

    } catch (error) {
      throw new Error(`Error processing PayPal payment: ${error}`)
    }
  }

  async refundPayment(transactionId: string, amount: number, reason: string): Promise<PaymentRefund> {
    const refund: PaymentRefund = {
      id: `paypal_refund_${Date.now()}`,
      transactionId,
      amount,
      reason,
      status: 'pending',
      createdAt: new Date()
    }

    // Simular procesamiento
    await new Promise(resolve => setTimeout(resolve, 800))
    refund.status = 'completed'
    refund.completedAt = new Date()

    return refund
  }

  async getTransactionStatus(providerTransactionId: string): Promise<PaymentTransaction['status']> {
    await new Promise(resolve => setTimeout(resolve, 300))
    return 'completed'
  }

  validateWebhook(payload: string, signature: string): boolean {
    return true
  }

  async processWebhook(webhook: PaymentWebhook): Promise<void> {
    // Implementar lógica de webhooks de PayPal
  }
}

// Implementación para MercadoPago (América Latina)
export class MercadoPagoProcessor extends PaymentProcessor {
  async processPayment(transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction> {
    try {
      const fees = this.calculateFees(transaction.amount)
      
      const paymentTransaction: PaymentTransaction = {
        ...transaction,
        id: `mp_${Date.now()}`,
        status: 'processing',
        providerTransactionId: `${Math.floor(Math.random() * 1000000000)}`,
        fees,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Simular llamada a MercadoPago API
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      paymentTransaction.status = Math.random() > 0.08 ? 'completed' : 'failed'
      if (paymentTransaction.status === 'completed') {
        paymentTransaction.completedAt = new Date()
      }

      await this.saveTransaction(paymentTransaction)
      return paymentTransaction

    } catch (error) {
      throw new Error(`Error processing MercadoPago payment: ${error}`)
    }
  }

  async refundPayment(transactionId: string, amount: number, reason: string): Promise<PaymentRefund> {
    const refund: PaymentRefund = {
      id: `mp_refund_${Date.now()}`,
      transactionId,
      amount,
      reason,
      status: 'pending',
      createdAt: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 600))
    refund.status = 'completed'
    refund.completedAt = new Date()

    return refund
  }

  async getTransactionStatus(providerTransactionId: string): Promise<PaymentTransaction['status']> {
    await new Promise(resolve => setTimeout(resolve, 250))
    return 'completed'
  }

  validateWebhook(payload: string, signature: string): boolean {
    return true
  }

  async processWebhook(webhook: PaymentWebhook): Promise<void> {
    // Implementar lógica de webhooks de MercadoPago
  }
}

// Factory para crear procesadores
export class PaymentProcessorFactory {
  static create(config: PaymentConfig): PaymentProcessor {
    switch (config.provider) {
      case 'stripe':
        return new StripeProcessor(config)
      case 'paypal':
        return new PayPalProcessor(config)
      case 'mercadopago':
        return new MercadoPagoProcessor(config)
      default:
        throw new Error(`Unsupported payment provider: ${config.provider}`)
    }
  }
}

// Manager principal de pagos
export class PaymentManager {
  private processors: Map<string, PaymentProcessor> = new Map()
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async initialize(): Promise<void> {
    // Cargar configuraciones de procesadores
    const { data: configs } = await this.supabase
      .from('payment_configs')
      .select('*')
      .eq('isActive', true)

    if (configs) {
      for (const config of configs) {
        try {
          const processor = PaymentProcessorFactory.create(config)
          this.processors.set(config.provider, processor)
        } catch (error) {
          console.error(`Failed to initialize processor ${config.provider}:`, error)
        }
      }
    }
  }

  async processPayment(
    provider: string,
    transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt' | 'provider'>
  ): Promise<PaymentTransaction> {
    const processor = this.processors.get(provider)
    if (!processor) {
      throw new Error(`Payment processor ${provider} not available`)
    }

    return processor.processPayment({ ...transaction, provider })
  }

  async refundPayment(provider: string, transactionId: string, amount: number, reason: string): Promise<PaymentRefund> {
    const processor = this.processors.get(provider)
    if (!processor) {
      throw new Error(`Payment processor ${provider} not available`)
    }

    return processor.refundPayment(transactionId, amount, reason)
  }

  async handleWebhook(provider: string, payload: string, signature: string): Promise<void> {
    const processor = this.processors.get(provider)
    if (!processor) {
      throw new Error(`Payment processor ${provider} not available`)
    }

    if (!processor.validateWebhook(payload, signature)) {
      throw new Error('Invalid webhook signature')
    }

    const webhook: PaymentWebhook = {
      id: `webhook_${Date.now()}`,
      provider,
      eventType: 'unknown', // Extraer del payload
      data: JSON.parse(payload),
      signature,
      processed: false,
      createdAt: new Date()
    }

    await processor.processWebhook(webhook)
  }

  getAvailableProcessors(): string[] {
    return Array.from(this.processors.keys())
  }

  async getTransactionHistory(orderId?: string, limit = 50): Promise<PaymentTransaction[]> {
    let query = this.supabase
      .from('payment_transactions')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit)

    if (orderId) {
      query = query.eq('orderId', orderId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  async getPaymentAnalytics(startDate: Date, endDate: Date) {
    const { data, error } = await this.supabase
      .from('payment_transactions')
      .select('*')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())

    if (error) throw error

    const transactions = data || []
    
    return {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      successfulTransactions: transactions.filter(t => t.status === 'completed').length,
      failedTransactions: transactions.filter(t => t.status === 'failed').length,
      totalFees: transactions.reduce((sum, t) => sum + (t.fees?.totalFees || 0), 0),
      averageTransactionAmount: transactions.length > 0 ? 
        transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length : 0,
      providerBreakdown: transactions.reduce((acc, t) => {
        acc[t.provider] = (acc[t.provider] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }
}

// Hook de React para usar el sistema de pagos
export function usePaymentSystem() {
  const [manager] = React.useState(() => new PaymentManager())
  const [loading, setLoading] = React.useState(true)
  const [processors, setProcessors] = React.useState<string[]>([])

  React.useEffect(() => {
    const initializeManager = async () => {
      try {
        await manager.initialize()
        setProcessors(manager.getAvailableProcessors())
      } catch (error) {
        console.error('Failed to initialize payment manager:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeManager()
  }, [manager])

  const processPayment = React.useCallback(async (
    provider: string,
    transaction: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt' | 'provider'>
  ) => {
    return manager.processPayment(provider, transaction)
  }, [manager])

  const refundPayment = React.useCallback(async (
    provider: string,
    transactionId: string,
    amount: number,
    reason: string
  ) => {
    return manager.refundPayment(provider, transactionId, amount, reason)
  }, [manager])

  const getTransactionHistory = React.useCallback(async (orderId?: string, limit?: number) => {
    return manager.getTransactionHistory(orderId, limit)
  }, [manager])

  const getPaymentAnalytics = React.useCallback(async (startDate: Date, endDate: Date) => {
    return manager.getPaymentAnalytics(startDate, endDate)
  }, [manager])

  return {
    loading,
    processors,
    processPayment,
    refundPayment,
    getTransactionHistory,
    getPaymentAnalytics,
    handleWebhook: manager.handleWebhook.bind(manager)
  }
}

export default PaymentManager