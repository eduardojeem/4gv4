'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface Promotion {
  id: string
  name: string
  code: string
  description?: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase?: number
  max_discount?: number
  start_date: string
  end_date: string
  is_active: boolean
  usage_count: number
  usage_limit?: number
}

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  // Load active promotions
  const loadPromotions = useCallback(async () => {
    try {
      setLoading(true)

      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .or(`start_date.lte.${now},start_date.is.null`)
        .or(`end_date.gte.${now},end_date.is.null`)

      if (error) {
        console.error('Supabase error loading promotions:', error)
        throw error
      }

      setPromotions(data || [])
    } catch (error: unknown) {
      // Error handling preserved
      const message =
        typeof error === 'object' && error && 'message' in error
          ? (error as Error).message
          : String(error ?? 'Unknown error')
      
      console.error('Error loading promotions:', { 
        message, 
        error: error instanceof Error ? error.stack : error 
      })
      
      if (error && typeof error === 'object' && Object.keys(error).length > 0) {
        toast.warning('No se pudo cargar promociones')
      }
      
      setPromotions([])
    } finally {
      setLoading(false)
    }
  }, [])

interface CartItem {
  id: string
  product_id: string
  name: string
  price: number
  quantity: number
  category_id?: string
}

  // Apply promotions to cart
  const applyPromotionsToCart = useCallback((cartItems: CartItem[], subtotal: number) => {
    let totalDiscount = 0
    const appliedPromotions: string[] = []

    for (const promo of promotions) {
      // Check usage limits if applicable
      if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
        continue
      }

      let discount = 0

      // Check min purchase amount
      if (promo.min_purchase && subtotal < promo.min_purchase) {
        continue
      }

      switch (promo.type) {
        case 'percentage':
          discount = (subtotal * promo.value) / 100
          // Apply max discount cap if exists
          if (promo.max_discount && discount > promo.max_discount) {
            discount = promo.max_discount
          }
          if (discount > 0) {
             appliedPromotions.push(promo.name)
          }
          break
        case 'fixed':
          discount = promo.value
          if (discount > 0) {
            appliedPromotions.push(promo.name)
          }
          break
      }
      
      totalDiscount += discount
    }

    // Ensure we don't discount more than subtotal
    if (totalDiscount > subtotal) {
      totalDiscount = subtotal
    }

    return { 
      totalDiscount, 
      finalTotal: subtotal - totalDiscount,
      appliedPromotions 
    }
  }, [promotions])

  // Create promotion
  const createPromotion = async (promotion: Omit<Promotion, 'id' | 'usage_count'>) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('promotions')
        .insert([{ ...promotion, usage_count: 0 }])
        .select()
        .single()

      if (error) throw error
      
      setPromotions(prev => [...prev, data])
      toast.success('Promoción creada exitosamente')
      return data
    } catch (error: unknown) {
      console.error('Error creating promotion:', error)
      toast.error('Error al crear la promoción')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Update promotion
  const updatePromotion = async (id: string, updates: Partial<Promotion>) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('promotions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setPromotions(prev => prev.map(p => p.id === id ? data : p))
      toast.success('Promoción actualizada exitosamente')
      return data
    } catch (error: unknown) {
      console.error('Error updating promotion:', error)
      toast.error('Error al actualizar la promoción')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Delete promotion
  const deletePromotion = async (id: string) => {
    try {
      setLoading(true)
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPromotions(prev => prev.filter(p => p.id !== id))
      toast.success('Promoción eliminada exitosamente')
    } catch (error: unknown) {
      console.error('Error deleting promotion:', error)
      toast.error('Error al eliminar la promoción')
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    promotions,
    loading,
    loadPromotions,
    applyPromotionsToCart,
    createPromotion,
    updatePromotion,
    deletePromotion
  }
}
