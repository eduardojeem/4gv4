'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useCustomerState, Customer, CustomerFilters, CustomerState } from '@/hooks/use-customer-state'
import { useCustomerActions } from '@/hooks/use-customer-actions'

interface CustomerContextValue {
    // State
    customers: Customer[]
    filteredCustomers: Customer[]
    paginatedCustomers: Customer[]
    filters: CustomerFilters
    viewMode: 'table' | 'grid' | 'timeline'
    selectedCustomer: Customer | null
    loading: boolean
    searching: boolean
    error: string | null
    sortBy: string
    sortOrder: 'asc' | 'desc'
    pagination: CustomerState['pagination']

    // Pagination actions
    setPage: (page: number) => void
    setItemsPerPage: (itemsPerPage: number) => void
    nextPage: () => void
    prevPage: () => void

    // Actions
    updateFilters: (newFilters: Partial<CustomerFilters>) => void
    setViewMode: (mode: 'table' | 'grid' | 'timeline') => void
    selectCustomer: (customer: Customer | null) => void
    refreshCustomers: () => Promise<Customer[] | undefined>
    createCustomer: (customerData: Partial<Customer>) => Promise<{ success: boolean; customer?: Customer; error?: any }>
    updateCustomer: (id: string, customerData: Partial<Customer>) => Promise<{ success: boolean; customer?: Customer; error?: any }>
    deleteCustomer: (id: string) => Promise<{ success: boolean; error?: any }>
    exportCustomers: (format: 'csv' | 'excel' | 'pdf', customers?: Customer[]) => Promise<{ success: boolean; error?: any }>
    importCustomers: (file: File) => Promise<{ success: boolean; imported?: number; error?: any }>
    sendMessage: (customerIds: string[], message: string, type: 'email' | 'sms' | 'whatsapp') => Promise<{ success: boolean; sent?: number; error?: any }>
    generateReport: (type: 'sales' | 'activity' | 'segmentation', filters?: Partial<CustomerFilters>) => Promise<{ success: boolean; reportUrl?: string; error?: any }>
    bulkUpdate: (customerIds: string[], updates: Partial<Customer>) => Promise<{ success: boolean; updated?: number; error?: any }>
    addNote: (customerId: string, note: string) => Promise<{ success: boolean; error?: any }>
    addTag: (customerId: string, tag: string) => Promise<{ success: boolean; error?: any }>
    removeTag: (customerId: string, tag: string) => Promise<{ success: boolean; error?: any }>
}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
    const state = useCustomerState()
    const actions = useCustomerActions({ setState: state.setState })

    const value: CustomerContextValue = {
        // Spread all state (excluding setState)
        customers: state.customers,
        filteredCustomers: state.filteredCustomers,
        paginatedCustomers: state.paginatedCustomers,
        filters: state.filters,
        viewMode: state.viewMode,
        selectedCustomer: state.selectedCustomer,
        loading: state.loading,
        searching: state.searching,
        error: state.error,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        pagination: state.pagination,
        setPage: state.setPage,
        setItemsPerPage: state.setItemsPerPage,
        nextPage: state.nextPage,
        prevPage: state.prevPage,
        // Spread all actions
        ...actions
    }

    return (
        <CustomerContext.Provider value={value}>
            {children}
        </CustomerContext.Provider>
    )
}

export function useCustomers() {
    const context = useContext(CustomerContext)
    if (!context) {
        throw new Error('useCustomers must be used within a CustomerProvider')
    }
    return context
}
