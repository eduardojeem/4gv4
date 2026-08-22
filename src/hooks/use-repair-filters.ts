import { useState, useMemo, useCallback } from 'react'
import { Repair, RepairStatus, RepairPriority } from '@/types/repairs'
import { DateRange } from 'react-day-picker'
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns'
import { useDebounce } from '@/hooks/use-debounce'
import { getWarrantyStatus, WarrantyStatus } from '@/lib/warranty-utils'

export type WarrantyFilterType = 'all' | 'in_warranty' | 'expiring' | 'expired' | 'no_warranty'

interface UseRepairFiltersProps {
    repairs: Repair[]
}

export function useRepairFilters({ repairs }: UseRepairFiltersProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<RepairStatus | 'all'>('all')
    const [priorityFilter, setPriorityFilter] = useState<RepairPriority | 'all'>('all')
    const [technicianFilter, setTechnicianFilter] = useState<string>('all')
    const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilterType>('all')
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

    // Debounce search term to reduce filtering frequency
    const debouncedSearchTerm = useDebounce(searchTerm, 300)

    // Pre-compute date range values for better performance
    const dateRangeFilter = useMemo(() => {
        if (!dateRange?.from) return null
        return {
            from: startOfDay(dateRange.from),
            to: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)
        }
    }, [dateRange])

    // Optimized filtering with early returns and minimal string operations
    const filteredRepairs = useMemo(() => {
        // Early return if no repairs
        if (repairs.length === 0) return []

        // Pre-compute search term for performance
        const searchLower = debouncedSearchTerm.toLowerCase()
        const hasSearch = searchLower.length > 0

        return repairs.filter((repair) => {
            // 1. Status Filter (fastest check first)
            if (statusFilter !== 'all' && repair.status !== statusFilter) {
                return false
            }

            // 2. Priority Filter
            if (priorityFilter !== 'all' && repair.priority !== priorityFilter) {
                return false
            }

            // 3. Technician Filter
            if (technicianFilter !== 'all' && repair.technician?.id !== technicianFilter) {
                return false
            }

            // 4. Warranty Filter
            if (warrantyFilter !== 'all') {
                const ws = getWarrantyStatus(repair.warrantyExpiresAt)
                if (warrantyFilter === 'in_warranty') {
                    if (ws !== 'active' && ws !== 'expiring') return false
                } else if (warrantyFilter === 'expiring') {
                    if (ws !== 'expiring') return false
                } else if (warrantyFilter === 'expired') {
                    if (ws !== 'expired') return false
                } else if (warrantyFilter === 'no_warranty') {
                    if (ws !== 'none') return false
                }
            }

            // 5. Date Range Filter (pre-computed)
            if (dateRangeFilter) {
                const repairDate = new Date(repair.createdAt)
                if (!isWithinInterval(repairDate, { start: dateRangeFilter.from, end: dateRangeFilter.to })) {
                    return false
                }
            }

            // 6. Search Term (most expensive, do last)
            if (hasSearch) {
                // Use cached lowercase values if available, otherwise compute once
                const customerName = repair.customer.name.toLowerCase()
                const device = repair.device.toLowerCase()
                const id = repair.id.toLowerCase()
                const brand = (repair.brand || '').toLowerCase()
                const model = (repair.model || '').toLowerCase()
                const ticketNumber = (repair.ticketNumber || '').toLowerCase()

                return (
                    customerName.includes(searchLower) ||
                    device.includes(searchLower) ||
                    id.includes(searchLower) ||
                    brand.includes(searchLower) ||
                    model.includes(searchLower) ||
                    ticketNumber.includes(searchLower)
                )
            }

            return true
        })
    }, [repairs, statusFilter, priorityFilter, technicianFilter, warrantyFilter, dateRangeFilter, debouncedSearchTerm])

    // Reset all filters
    const clearFilters = useCallback(() => {
        setSearchTerm('')
        setStatusFilter('all')
        setPriorityFilter('all')
        setTechnicianFilter('all')
        setWarrantyFilter('all')
        setDateRange(undefined)
    }, [])

    // Active filters count
    const activeFiltersCount = [
        statusFilter !== 'all',
        priorityFilter !== 'all',
        technicianFilter !== 'all',
        warrantyFilter !== 'all',
        dateRange !== undefined,
        searchTerm !== ''
    ].filter(Boolean).length

    return {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        priorityFilter,
        setPriorityFilter,
        technicianFilter,
        setTechnicianFilter,
        warrantyFilter,
        setWarrantyFilter,
        dateRange,
        setDateRange,
        filteredRepairs,
        clearFilters,
        activeFiltersCount
    }
}
