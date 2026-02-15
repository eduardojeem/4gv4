"use client"

import useSWR, { mutate as globalMutate } from 'swr'
import customerService from '@/services/customer-service'
import type { Customer } from '@/hooks/use-customer-state'
import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type SWRError = { status?: number; message?: string }

type CreditSummary = {
  credit_id: string
  total_principal: number
  total_installments: number
  total_pagado: number
  saldo_pendiente: number
  progreso: number
} | null

type InstallmentProgress = {
  id: string
  credit_id: string
  installment_number: number
  due_date: string
  amount: number
  amount_paid: number
  status_effective: 'pending' | 'paid' | 'late'
  progreso: number
}

type CustomerWithCredit = Customer & {
  credit_summary?: CreditSummary
  credit_installments_progress?: InstallmentProgress[]
  authorized_persons?: any[]
}

export function useCustomerData(customerId: number | string | null) {
  const id = customerId ? String(customerId) : null
  const { data, error, mutate } = useSWR(
    id ? ['customer', id] : null,
    async () => {
      const resp = await customerService.getCustomer(id as string)
      if (!resp.success || !resp.data) {
        throw { status: 404, message: resp.error || 'Cliente no encontrado' } as SWRError
      }
      const result: CustomerWithCredit = { ...(resp.data as Customer) }
      try {
        const [creditSummary, installments] = await Promise.all([
          customerService.getCustomerCreditSummary(id as string),
          customerService.getCustomerInstallmentsProgress(id as string),
        ])
        if (creditSummary.success) {
          result.credit_summary = (creditSummary.data as CreditSummary) || null
        }
        if (installments.success) {
          result.credit_installments_progress = (installments.data as InstallmentProgress[]) || []
        }
        
        // Cargar personas autorizadas si hay profile_id
        if (result.profile_id) {
          const authPersons = await customerService.getCustomerAuthorizedPersons(result.profile_id)
          if (authPersons.success) {
            result.authorized_persons = authPersons.data || []
          }
        }
      } catch {
        // Ignorar errores de crédito y autorizados para no bloquear la carga del cliente
      }
      return result
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        const error = err as SWRError
        if (error.status === 404) return
        if (retryCount >= 3) return
        setTimeout(() => revalidate({ retryCount }), 1000 * retryCount)
      },
    }
  )
  useCustomerCreditRealtime(
    id,
    (data as CustomerWithCredit | undefined)?.credit_summary?.credit_id ?? null,
    mutate
  )

  return { data, error, mutate, isLoading: !data && !error }
}

export function useCustomerPurchases(customerId: number | string | null) {
  const id = customerId ? String(customerId) : null
  const { data, error, mutate } = useSWR(
    id ? ['sales', id] : null,
    async () => {
      const resp = await customerService.getCustomerSales(id as string)
      if (!resp.success) {
        throw { status: 500, message: resp.error || 'Error al obtener ventas' } as SWRError
      }
      return resp.data || []
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      errorRetryCount: 2,
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        const error = err as SWRError
        if (error.status === 404) return
        if (retryCount >= 2) return
        setTimeout(() => revalidate({ retryCount }), 800 * retryCount)
      },
    }
  )

  return { data, error, mutate, isLoading: !data && !error }
}

export async function prefetchCustomerPurchases(customerId: number | string) {
  try {
    const id = String(customerId)
    const resp = await customerService.getCustomerSales(id)
    if (resp.success && resp.data) {
      await globalMutate(['sales', id], resp.data, false)
    }
  } catch {
    // Silently handle prefetch errors - sales table might not exist yet
    // This is expected behavior if the sales feature hasn't been implemented
  }
}

export async function prefetchSimilarCustomers(segment: string) {
  try {
    const resp = await customerService.getCustomers(1, 200)
    const all = resp.data || []
    const similar = all.filter(c => c.segment === segment)
    await globalMutate(['customers', 'segment', segment], similar, false)
  } catch {
    console.warn('Prefetch similar customers failed')
  }
}

export function useCustomerCreditRealtime(
  customerId: number | string | null,
  currentCreditId?: string | null,
  onChange?: () => void
) {
  const id = customerId ? String(customerId) : null
  const debounceRef = useRef<number | undefined>(undefined)
  const triggerChange = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = window.setTimeout(() => {
      onChange?.()
    }, 500)
  }, [onChange])
  useEffect(() => {
    if (!id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`customer-${id}-credit-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_credits', filter: `customer_id=eq.${id}` },
        () => triggerChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers', filter: `id=eq.${id}` },
        () => triggerChange()
      )

    if (currentCreditId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credit_installments', filter: `credit_id=eq.${currentCreditId}` },
        () => triggerChange()
      )
    }

    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, currentCreditId, triggerChange])
}
