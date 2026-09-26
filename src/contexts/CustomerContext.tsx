'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { Customer, CustomerFilters, CustomerState } from '@/hooks/use-customer-state'
import { useCustomerDirectoryState } from '@/hooks/use-customer-directory-state'
import { useCustomerActions } from '@/hooks/use-customer-actions'

interface CustomerContextValue extends ReturnType<typeof useCustomerActions> {
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
    directorySummary: { total: number; active: number }

    // Pagination actions
    setPage: (page: number) => void
    setItemsPerPage: (itemsPerPage: number) => void
    setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void
    nextPage: () => void
    prevPage: () => void

}

const CustomerContext = createContext<CustomerContextValue | null>(null)

export function CustomerProvider({ children }: { children: ReactNode }) {
    const state = useCustomerDirectoryState()
    const actions = useCustomerActions({ setState: state.setState, onRefresh: state.refreshPage })

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
        directorySummary: state.directorySummary,
        setPage: state.setPage,
        setItemsPerPage: state.setItemsPerPage,
        setSort: state.setSort,
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
