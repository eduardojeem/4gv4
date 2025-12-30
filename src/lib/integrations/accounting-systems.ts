import { createClient } from '@supabase/supabase-js'
import React from 'react'

// Interfaces para sistemas contables
export interface AccountingAccount {
  id: string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  subType: string
  balance: number
  currency: string
  isActive: boolean
  parentAccountId?: string
  taxCode?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface AccountingTransaction {
  id: string
  reference: string
  description: string
  date: Date
  type: 'journal' | 'invoice' | 'payment' | 'adjustment'
  status: 'draft' | 'posted' | 'voided'
  totalAmount: number
  currency: string
  entries: AccountingEntry[]
  attachments?: string[]
  metadata?: Record<string, any>
  externalId?: string
  syncStatus: 'pending' | 'synced' | 'error'
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface AccountingEntry {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  debitAmount: number
  creditAmount: number
  description?: string
  taxAmount?: number
  taxCode?: string
  projectId?: string
  customerId?: string
  supplierId?: string
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  taxNumber?: string
  paymentTerms?: string
  creditLimit?: number
  balance: number
  isActive: boolean
  externalId?: string
  syncStatus: 'pending' | 'synced' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface Supplier {
  id: string
  name: string
  email?: string
  phone?: string
  address?: {
    street: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  taxNumber?: string
  paymentTerms?: string
  balance: number
  isActive: boolean
  externalId?: string
  syncStatus: 'pending' | 'synced' | 'error'
  createdAt: Date
  updatedAt: Date
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  date: Date
  dueDate: Date
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  currency: string
  lineItems: InvoiceLineItem[]
  paymentTerms?: string
  notes?: string
  externalId?: string
  syncStatus: 'pending' | 'synced' | 'error'
  lastSyncAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceLineItem {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  taxAmount: number
  taxCode?: string
  accountCode?: string
}

export interface AccountingConfig {
  provider: 'quickbooks' | 'xero' | 'sage' | 'zoho' | 'freshbooks'
  isActive: boolean
  credentials: {
    clientId?: string
    clientSecret?: string
    accessToken?: string
    refreshToken?: string
    realmId?: string
    tenantId?: string
    apiKey?: string
  }
  settings: {
    baseCurrency: string
    fiscalYearStart: string
    autoSync: boolean
    syncInterval: number // en minutos
    defaultAccounts: {
      salesAccount: string
      taxAccount: string
      receivablesAccount: string
      payablesAccount: string
      inventoryAccount: string
    }
  }
  lastSyncAt?: Date
  syncErrors?: string[]
}

export interface SyncResult {
  success: boolean
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
  errors: string[]
  duration: number
  timestamp: Date
}

// Clase base para sistemas contables
export abstract class AccountingSystem {
  protected config: AccountingConfig
  protected supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  constructor(config: AccountingConfig) {
    this.config = config
  }

  // Métodos abstractos que deben implementar los sistemas específicos
  abstract authenticate(): Promise<boolean>
  abstract syncAccounts(): Promise<SyncResult>
  abstract syncCustomers(): Promise<SyncResult>
  abstract syncSuppliers(): Promise<SyncResult>
  abstract syncTransactions(startDate?: Date, endDate?: Date): Promise<SyncResult>
  abstract createInvoice(invoice: Omit<Invoice, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Invoice>
  abstract updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice>
  abstract createCustomer(customer: Omit<Customer, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Customer>
  abstract createTransaction(transaction: Omit<AccountingTransaction, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<AccountingTransaction>

  // Métodos comunes
  async saveAccount(account: AccountingAccount): Promise<void> {
    const { error } = await this.supabase
      .from('accounting_accounts')
      .upsert(account)

    if (error) throw error
  }

  async saveCustomer(customer: Customer): Promise<void> {
    const { error } = await this.supabase
      .from('accounting_customers')
      .upsert(customer)

    if (error) throw error
  }

  async saveTransaction(transaction: AccountingTransaction): Promise<void> {
    const { error } = await this.supabase
      .from('accounting_transactions')
      .upsert(transaction)

    if (error) throw error
  }

  async getAccounts(): Promise<AccountingAccount[]> {
    const { data, error } = await this.supabase
      .from('accounting_accounts')
      .select('*')
      .eq('isActive', true)
      .order('code')

    if (error) throw error
    return data || []
  }

  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await this.supabase
      .from('accounting_customers')
      .select('*')
      .eq('isActive', true)
      .order('name')

    if (error) throw error
    return data || []
  }

  async updateSyncStatus(recordType: string, recordId: string, status: 'pending' | 'synced' | 'error', error?: string): Promise<void> {
    const table = `accounting_${recordType}`
    const updates: any = {
      syncStatus: status,
      lastSyncAt: new Date(),
      updatedAt: new Date()
    }

    if (error && status === 'error') {
      updates.syncError = error
    }

    await this.supabase
      .from(table)
      .update(updates)
      .eq('id', recordId)
  }
}

// Implementación para QuickBooks
export class QuickBooksIntegration extends AccountingSystem {
  private baseUrl = 'https://sandbox-quickbooks.api.intuit.com'

  async authenticate(): Promise<boolean> {
    try {
      // Implementar autenticación OAuth2 con QuickBooks
      // En un entorno real, usar el SDK oficial de QuickBooks
      
      // Simular autenticación exitosa
      await new Promise(resolve => setTimeout(resolve, 1000))
      return true
    } catch (error) {
      console.error('QuickBooks authentication failed:', error)
      return false
    }
  }

  async syncAccounts(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    try {
      // Simular obtención de cuentas desde QuickBooks
      const mockAccounts = [
        {
          id: 'qb_acc_1',
          code: '1000',
          name: 'Efectivo',
          type: 'asset' as const,
          subType: 'current_asset',
          balance: 50000,
          currency: 'USD',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'qb_acc_2',
          code: '4000',
          name: 'Ventas',
          type: 'revenue' as const,
          subType: 'sales_revenue',
          balance: 0,
          currency: 'USD',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      for (const account of mockAccounts) {
        try {
          await this.saveAccount(account)
          result.recordsCreated++
        } catch (error) {
          result.errors.push(`Error saving account ${account.code}: ${error}`)
        }
        result.recordsProcessed++
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Sync failed: ${error}`)
    }

    result.duration = Date.now() - startTime
    return result
  }

  async syncCustomers(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    try {
      // Simular obtención de clientes desde QuickBooks
      const mockCustomers = [
        {
          id: 'qb_cust_1',
          name: 'Acme Corporation',
          email: 'contact@acme.com',
          phone: '+1-555-0123',
          balance: 1500,
          isActive: true,
          externalId: 'qb_customer_123',
          syncStatus: 'synced' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      for (const customer of mockCustomers) {
        try {
          await this.saveCustomer(customer)
          result.recordsCreated++
        } catch (error) {
          result.errors.push(`Error saving customer ${customer.name}: ${error}`)
        }
        result.recordsProcessed++
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Customer sync failed: ${error}`)
    }

    result.duration = Date.now() - startTime
    return result
  }

  async syncSuppliers(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    // Implementar sincronización de proveedores
    result.duration = Date.now() - startTime
    return result
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    try {
      // Simular obtención de transacciones desde QuickBooks
      const mockTransactions = [
        {
          id: 'qb_trans_1',
          reference: 'INV-001',
          description: 'Venta de productos',
          date: new Date(),
          type: 'invoice' as const,
          status: 'posted' as const,
          totalAmount: 1000,
          currency: 'USD',
          entries: [
            {
              id: 'entry_1',
              accountId: 'qb_acc_1',
              accountCode: '1000',
              accountName: 'Efectivo',
              debitAmount: 1000,
              creditAmount: 0,
              description: 'Venta de productos'
            },
            {
              id: 'entry_2',
              accountId: 'qb_acc_2',
              accountCode: '4000',
              accountName: 'Ventas',
              debitAmount: 0,
              creditAmount: 1000,
              description: 'Venta de productos'
            }
          ],
          externalId: 'qb_transaction_456',
          syncStatus: 'synced' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      for (const transaction of mockTransactions) {
        try {
          await this.saveTransaction(transaction)
          result.recordsCreated++
        } catch (error) {
          result.errors.push(`Error saving transaction ${transaction.reference}: ${error}`)
        }
        result.recordsProcessed++
      }

    } catch (error) {
      result.success = false
      result.errors.push(`Transaction sync failed: ${error}`)
    }

    result.duration = Date.now() - startTime
    return result
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    try {
      // Simular creación de factura en QuickBooks
      await new Promise(resolve => setTimeout(resolve, 500))

      const newInvoice: Invoice = {
        ...invoice,
        id: `qb_inv_${Date.now()}`,
        externalId: `qb_invoice_${Math.random().toString(36).substr(2, 9)}`,
        syncStatus: 'synced',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Guardar en base de datos local
      const { error } = await this.supabase
        .from('accounting_invoices')
        .insert(newInvoice)

      if (error) throw error

      return newInvoice

    } catch (error) {
      throw new Error(`Error creating QuickBooks invoice: ${error}`)
    }
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    try {
      // Simular actualización en QuickBooks
      await new Promise(resolve => setTimeout(resolve, 300))

      const { data, error } = await this.supabase
        .from('accounting_invoices')
        .update({ ...updates, updatedAt: new Date(), syncStatus: 'synced' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data

    } catch (error) {
      throw new Error(`Error updating QuickBooks invoice: ${error}`)
    }
  }

  async createCustomer(customer: Omit<Customer, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    try {
      // Simular creación de cliente en QuickBooks
      await new Promise(resolve => setTimeout(resolve, 400))

      const newCustomer: Customer = {
        ...customer,
        id: `qb_cust_${Date.now()}`,
        externalId: `qb_customer_${Math.random().toString(36).substr(2, 9)}`,
        syncStatus: 'synced',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await this.saveCustomer(newCustomer)
      return newCustomer

    } catch (error) {
      throw new Error(`Error creating QuickBooks customer: ${error}`)
    }
  }

  async createTransaction(transaction: Omit<AccountingTransaction, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<AccountingTransaction> {
    try {
      // Simular creación de transacción en QuickBooks
      await new Promise(resolve => setTimeout(resolve, 600))

      const newTransaction: AccountingTransaction = {
        ...transaction,
        id: `qb_trans_${Date.now()}`,
        externalId: `qb_transaction_${Math.random().toString(36).substr(2, 9)}`,
        syncStatus: 'synced',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      await this.saveTransaction(newTransaction)
      return newTransaction

    } catch (error) {
      throw new Error(`Error creating QuickBooks transaction: ${error}`)
    }
  }
}

// Implementación para Xero
export class XeroIntegration extends AccountingSystem {
  private baseUrl = 'https://api.xero.com/api.xro/2.0'

  async authenticate(): Promise<boolean> {
    try {
      // Implementar autenticación OAuth2 con Xero
      await new Promise(resolve => setTimeout(resolve, 800))
      return true
    } catch (error) {
      console.error('Xero authentication failed:', error)
      return false
    }
  }

  async syncAccounts(): Promise<SyncResult> {
    // Implementación similar a QuickBooks pero adaptada para Xero
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    // Simular sincronización
    await new Promise(resolve => setTimeout(resolve, 1200))
    result.recordsProcessed = 15
    result.recordsCreated = 10
    result.recordsUpdated = 5

    result.duration = Date.now() - startTime
    return result
  }

  async syncCustomers(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 8,
      recordsCreated: 6,
      recordsUpdated: 2,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 900))
    result.duration = Date.now() - startTime
    return result
  }

  async syncSuppliers(): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 5,
      recordsCreated: 3,
      recordsUpdated: 2,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 600))
    result.duration = Date.now() - startTime
    return result
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
      success: true,
      recordsProcessed: 25,
      recordsCreated: 20,
      recordsUpdated: 5,
      recordsSkipped: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    }

    await new Promise(resolve => setTimeout(resolve, 1500))
    result.duration = Date.now() - startTime
    return result
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    await new Promise(resolve => setTimeout(resolve, 400))
    
    const newInvoice: Invoice = {
      ...invoice,
      id: `xero_inv_${Date.now()}`,
      externalId: `xero_invoice_${Math.random().toString(36).substr(2, 9)}`,
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return newInvoice
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Simular actualización
    return {
      id,
      ...updates,
      updatedAt: new Date(),
      syncStatus: 'synced'
    } as Invoice
  }

  async createCustomer(customer: Omit<Customer, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    await new Promise(resolve => setTimeout(resolve, 350))
    
    const newCustomer: Customer = {
      ...customer,
      id: `xero_cust_${Date.now()}`,
      externalId: `xero_customer_${Math.random().toString(36).substr(2, 9)}`,
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return newCustomer
  }

  async createTransaction(transaction: Omit<AccountingTransaction, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<AccountingTransaction> {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newTransaction: AccountingTransaction = {
      ...transaction,
      id: `xero_trans_${Date.now()}`,
      externalId: `xero_transaction_${Math.random().toString(36).substr(2, 9)}`,
      syncStatus: 'synced',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return newTransaction
  }
}

// Factory para crear integraciones contables
export class AccountingSystemFactory {
  static create(config: AccountingConfig): AccountingSystem {
    switch (config.provider) {
      case 'quickbooks':
        return new QuickBooksIntegration(config)
      case 'xero':
        return new XeroIntegration(config)
      default:
        throw new Error(`Unsupported accounting system: ${config.provider}`)
    }
  }
}

// Manager principal de sistemas contables
export class AccountingManager {
  private systems: Map<string, AccountingSystem> = new Map()
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async initialize(): Promise<void> {
    const { data: configs } = await this.supabase
      .from('accounting_configs')
      .select('*')
      .eq('isActive', true)

    if (configs) {
      for (const config of configs) {
        try {
          const system = AccountingSystemFactory.create(config)
          const authenticated = await system.authenticate()
          
          if (authenticated) {
            this.systems.set(config.provider, system)
          }
        } catch (error) {
          console.error(`Failed to initialize accounting system ${config.provider}:`, error)
        }
      }
    }
  }

  async syncAll(): Promise<Record<string, SyncResult[]>> {
    const results: Record<string, SyncResult[]> = {}

    for (const [provider, system] of this.systems) {
      try {
        const syncResults = await Promise.all([
          system.syncAccounts(),
          system.syncCustomers(),
          system.syncSuppliers(),
          system.syncTransactions()
        ])

        results[provider] = syncResults
      } catch (error) {
        console.error(`Sync failed for ${provider}:`, error)
        results[provider] = []
      }
    }

    return results
  }

  async createInvoice(provider: string, invoice: Omit<Invoice, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const system = this.systems.get(provider)
    if (!system) {
      throw new Error(`Accounting system ${provider} not available`)
    }

    return system.createInvoice(invoice)
  }

  async getFinancialReports(startDate: Date, endDate: Date) {
    const { data: transactions } = await this.supabase
      .from('accounting_transactions')
      .select('*')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString())
      .eq('status', 'posted')

    const { data: accounts } = await this.supabase
      .from('accounting_accounts')
      .select('*')
      .eq('isActive', true)

    // Generar reportes financieros básicos
    return {
      profitAndLoss: this.generateProfitAndLoss(transactions || [], accounts || []),
      balanceSheet: this.generateBalanceSheet(accounts || []),
      cashFlow: this.generateCashFlow(transactions || [])
    }
  }

  private generateProfitAndLoss(transactions: AccountingTransaction[], accounts: AccountingAccount[]) {
    const revenueAccounts = accounts.filter(a => a.type === 'revenue')
    const expenseAccounts = accounts.filter(a => a.type === 'expense')

    let totalRevenue = 0
    let totalExpenses = 0

    for (const transaction of transactions) {
      for (const entry of transaction.entries) {
        const account = accounts.find(a => a.id === entry.accountId)
        if (account?.type === 'revenue') {
          totalRevenue += entry.creditAmount - entry.debitAmount
        } else if (account?.type === 'expense') {
          totalExpenses += entry.debitAmount - entry.creditAmount
        }
      }
    }

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      revenueAccounts: revenueAccounts.map(acc => ({
        ...acc,
        amount: this.getAccountBalance(acc.id, transactions)
      })),
      expenseAccounts: expenseAccounts.map(acc => ({
        ...acc,
        amount: this.getAccountBalance(acc.id, transactions)
      }))
    }
  }

  private generateBalanceSheet(accounts: AccountingAccount[]) {
    const assets = accounts.filter(a => a.type === 'asset')
    const liabilities = accounts.filter(a => a.type === 'liability')
    const equity = accounts.filter(a => a.type === 'equity')

    return {
      assets: {
        total: assets.reduce((sum, acc) => sum + acc.balance, 0),
        accounts: assets
      },
      liabilities: {
        total: liabilities.reduce((sum, acc) => sum + acc.balance, 0),
        accounts: liabilities
      },
      equity: {
        total: equity.reduce((sum, acc) => sum + acc.balance, 0),
        accounts: equity
      }
    }
  }

  private generateCashFlow(transactions: AccountingTransaction[]) {
    // Simplificado - en un entorno real sería más complejo
    const cashTransactions = transactions.filter(t => 
      t.entries.some(e => e.accountCode.startsWith('1000')) // Cuentas de efectivo
    )

    let operatingCashFlow = 0
    const investingCashFlow = 0
    let financingCashFlow = 0

    for (const transaction of cashTransactions) {
      const cashEntry = transaction.entries.find(e => e.accountCode.startsWith('1000'))
      if (cashEntry) {
        const netCashChange = cashEntry.debitAmount - cashEntry.creditAmount
        
        // Clasificación simplificada
        if (transaction.type === 'invoice' || transaction.type === 'payment') {
          operatingCashFlow += netCashChange
        } else {
          financingCashFlow += netCashChange
        }
      }
    }

    return {
      operating: operatingCashFlow,
      investing: investingCashFlow,
      financing: financingCashFlow,
      netCashFlow: operatingCashFlow + investingCashFlow + financingCashFlow
    }
  }

  private getAccountBalance(accountId: string, transactions: AccountingTransaction[]): number {
    let balance = 0

    for (const transaction of transactions) {
      for (const entry of transaction.entries) {
        if (entry.accountId === accountId) {
          balance += entry.debitAmount - entry.creditAmount
        }
      }
    }

    return balance
  }

  getAvailableSystems(): string[] {
    return Array.from(this.systems.keys())
  }
}

// Hook de React para usar sistemas contables
export function useAccountingSystem() {
  const [manager] = React.useState(() => new AccountingManager())
  const [loading, setLoading] = React.useState(true)
  const [systems, setSystems] = React.useState<string[]>([])

  React.useEffect(() => {
    const initializeManager = async () => {
      try {
        await manager.initialize()
        setSystems(manager.getAvailableSystems())
      } catch (error) {
        console.error('Failed to initialize accounting manager:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeManager()
  }, [manager])

  const syncAll = React.useCallback(async () => {
    return manager.syncAll()
  }, [manager])

  const createInvoice = React.useCallback(async (
    provider: string,
    invoice: Omit<Invoice, 'id' | 'externalId' | 'syncStatus' | 'createdAt' | 'updatedAt'>
  ) => {
    return manager.createInvoice(provider, invoice)
  }, [manager])

  const getFinancialReports = React.useCallback(async (startDate: Date, endDate: Date) => {
    return manager.getFinancialReports(startDate, endDate)
  }, [manager])

  return {
    loading,
    systems,
    syncAll,
    createInvoice,
    getFinancialReports
  }
}

export default AccountingManager