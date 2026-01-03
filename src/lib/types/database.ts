export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'vendedor' | 'tecnico' | 'cliente'
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'vendedor' | 'tecnico' | 'cliente'
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'vendedor' | 'tecnico' | 'cliente'
          avatar_url?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          first_name: string
          last_name: string
          document: string | null
          phone: string
          email: string | null
          address: string | null
          city: string | null
          country: string | null
          customer_type: 'nuevo' | 'regular' | 'frecuente' | 'vip'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          document?: string | null
          phone: string
          email?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          customer_type?: 'nuevo' | 'regular' | 'frecuente' | 'vip'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          document?: string | null
          phone?: string
          email?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          customer_type?: 'nuevo' | 'regular' | 'frecuente' | 'vip'
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          phone: string | null
          email: string | null
          address: string | null
          payment_terms: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          payment_terms?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_name?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          payment_terms?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          sku: string
          category_id: string
          supplier_id: string | null
          brand: string | null
          stock: number
          min_stock: number
          purchase_price: number
          sale_price: number
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sku: string
          category_id: string
          supplier_id?: string | null
          brand?: string | null
          stock?: number
          min_stock?: number
          purchase_price: number
          sale_price: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sku?: string
          category_id?: string
          supplier_id?: string | null
          brand?: string | null
          stock?: number
          min_stock?: number
          purchase_price?: number
          sale_price?: number
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          customer_id: string | null
          user_id: string
          total: number
          tax: number
          discount: number
          payment_method: 'efectivo' | 'tarjeta' | 'transferencia'
          status: 'pendiente' | 'completada' | 'cancelada'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          user_id: string
          total: number
          tax?: number
          discount?: number
          payment_method: 'efectivo' | 'tarjeta' | 'transferencia'
          status?: 'pendiente' | 'completada' | 'cancelada'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          user_id?: string
          total?: number
          tax?: number
          discount?: number
          payment_method?: 'efectivo' | 'tarjeta' | 'transferencia'
          status?: 'pendiente' | 'completada' | 'cancelada'
          created_at?: string
          updated_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          total: number
          created_at: string
        }
        Insert: {
          id?: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          total: number
          created_at?: string
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          total?: number
          created_at?: string
        }
      }
      repairs: {
        Row: {
          id: string
          customer_id: string
          device_brand: string
          device_model: string
          device_serial: string | null
          problem_description: string
          diagnosis: string | null
          estimated_cost: number | null
          final_cost: number | null
          status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'
          received_at: string
          estimated_completion: string | null
          completed_at: string | null
          delivered_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          device_brand: string
          device_model: string
          device_serial?: string | null
          problem_description: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'
          received_at?: string
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          device_brand?: string
          device_model?: string
          device_serial?: string | null
          problem_description?: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado'
          received_at?: string
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      repair_photos: {
        Row: {
          id: string
          repair_id: string
          photo_url: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          repair_id: string
          photo_url: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          repair_id?: string
          photo_url?: string
          description?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}