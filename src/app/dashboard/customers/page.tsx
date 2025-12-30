"use client"

import React from "react"
import { CustomerDashboard } from "@/components/dashboard/customers/CustomerDashboard"
import { CustomerErrorBoundary } from "@/components/dashboard/customers/CustomerErrorBoundary"
import { CustomerProvider } from "@/contexts/CustomerContext"

/**
 * Customers Page - Main entry point for customer management
 * 
 * This page has been refactored to use the new modular component architecture:
 * - CustomerProvider: Context provider for state management
 * - CustomerDashboard: Main container component
 * - CustomerErrorBoundary: Error handling wrapper
 * 
 * The previous 4600+ line monolithic component has been split into:
 * - CustomerList: Table/grid views
 * - CustomerFilters: Filtering logic  
 * - CustomerModal: Detail view
 * - AnalyticsDashboard: Charts/reports
 * - NotificationCenter: Alerts
 * - TimelineView: Activity history
 * 
 * Benefits of this refactoring:
 * - Improved maintainability and readability
 * - Better separation of concerns
 * - Enhanced performance through proper memoization
 * - Easier testing and debugging
 * - Better error handling and user experience
 * - Improved accessibility and code quality
 * - Centralized state management via Context
 */

export default function CustomersPage() {
  return (
    <CustomerProvider>
      <CustomerErrorBoundary>
        <CustomerDashboard />
      </CustomerErrorBoundary>
    </CustomerProvider>
  )
}
