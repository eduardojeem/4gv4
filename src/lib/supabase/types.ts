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
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          parent_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          contact_email: string | null
          phone: string | null
          address: string | null
          tax_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_name?: string | null
          contact_email?: string | null
          phone?: string | null
          address?: string | null
          tax_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_name?: string | null
          contact_email?: string | null
          phone?: string | null
          address?: string | null
          tax_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category_id: string | null
          brand: string | null
          supplier_id: string | null
          purchase_price: number
          sale_price: number
          wholesale_price: number | null
          stock_quantity: number
          min_stock: number
          unit_measure: string
          is_active: boolean
          images: string[] | null
          location: string | null
          barcode: string | null
          weight: number | null
          dimensions: Json | null
          tags: string[] | null
          featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price: number
          sale_price: number
          wholesale_price?: number | null
          stock_quantity?: number
          min_stock?: number
          unit_measure?: string
          is_active?: boolean
          images?: string[] | null
          location?: string | null
          barcode?: string | null
          weight?: number | null
          dimensions?: Json | null
          tags?: string[] | null
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number
          sale_price?: number
          wholesale_price?: number | null
          stock_quantity?: number
          min_stock?: number
          unit_measure?: string
          is_active?: boolean
          images?: string[] | null
          location?: string | null
          barcode?: string | null
          weight?: number | null
          dimensions?: Json | null
          tags?: string[] | null
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          }
        ]
      }
      product_movements: {
        Row: {
          id: string
          product_id: string
          movement_type: 'in' | 'out' | 'adjustment' | 'transfer'
          quantity: number
          previous_stock: number
          new_stock: number
          unit_cost: number | null
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          movement_type: 'in' | 'out' | 'adjustment' | 'transfer'
          quantity: number
          previous_stock: number
          new_stock: number
          unit_cost?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          movement_type?: 'in' | 'out' | 'adjustment' | 'transfer'
          quantity?: number
          previous_stock?: number
          new_stock?: number
          unit_cost?: number | null
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      product_price_history: {
        Row: {
          id: string
          product_id: string
          old_purchase_price: number
          new_purchase_price: number
          old_sale_price: number
          new_sale_price: number
          old_wholesale_price: number | null
          new_wholesale_price: number | null
          reason: string | null
          user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          old_purchase_price: number
          new_purchase_price: number
          old_sale_price: number
          new_sale_price: number
          old_wholesale_price?: number | null
          new_wholesale_price?: number | null
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          old_purchase_price?: number
          new_purchase_price?: number
          old_sale_price?: number
          new_sale_price?: number
          old_wholesale_price?: number | null
          new_wholesale_price?: number | null
          reason?: string | null
          user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      product_alerts: {
        Row: {
          id: string
          product_id: string
          alert_type: 'low_stock' | 'out_of_stock' | 'missing_supplier' | 'missing_category' | 'missing_image' | 'price_change'
          message: string
          is_resolved: boolean
          resolved_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          alert_type: 'low_stock' | 'out_of_stock' | 'missing_supplier' | 'missing_category' | 'missing_image' | 'price_change'
          message: string
          is_resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          alert_type?: 'low_stock' | 'out_of_stock' | 'missing_supplier' | 'missing_category' | 'missing_image' | 'price_change'
          message?: string
          is_resolved?: boolean
          resolved_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      products_detailed: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category_id: string | null
          category_name: string | null
          brand: string | null
          supplier_id: string | null
          supplier_name: string | null
          purchase_price: number
          sale_price: number
          wholesale_price: number | null
          stock_quantity: number
          min_stock: number
          unit_measure: string
          is_active: boolean
          images: string[] | null
          location: string | null
          barcode: string | null
          weight: number | null
          dimensions: Json | null
          tags: string[] | null
          featured: boolean
          margin_amount: number
          margin_percentage: number
          stock_value: number
          stock_status: string
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
      products_dashboard_stats: {
        Row: {
          total_products: number
          active_products: number
          total_stock_value: number
          total_cost_value: number
          total_margin: number
          avg_margin_percentage: number
          low_stock_count: number
          out_of_stock_count: number
          categories_count: number
          suppliers_count: number
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      has_inventory_permission: {
        Args: { user_id: string }
        Returns: boolean
      }
      has_sales_permission: {
        Args: { user_id: string }
        Returns: boolean
      }
      get_top_selling_products: {
        Args: { limit_count?: number }
        Returns: {
          product_id: string
          product_name: string
          total_sold: number
          total_revenue: number
        }[]
      }
      get_recent_movements: {
        Args: { 
          product_id?: string
          limit_count?: number 
        }
        Returns: {
          id: string
          product_name: string
          movement_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          reason: string
          created_at: string
        }[]
      }
      get_category_stats: {
        Args: Record<string, never>
        Returns: {
          category_id: string
          category_name: string
          product_count: number
          total_stock_value: number
          avg_margin_percentage: number
        }[]
      }
      get_supplier_stats: {
        Args: Record<string, never>
        Returns: {
          supplier_id: string
          supplier_name: string
          product_count: number
          total_stock_value: number
          avg_margin_percentage: number
        }[]
      }
      search_products: {
        Args: {
          search_term?: string
          category_filter?: string
          supplier_filter?: string
          stock_filter?: string
          price_min?: number
          price_max?: number
          limit_count?: number
          offset_count?: number
        }
        Returns: {
          id: string
          sku: string
          name: string
          description: string
          category_name: string
          supplier_name: string
          purchase_price: number
          sale_price: number
          stock_quantity: number
          min_stock: number
          is_active: boolean
          margin_percentage: number
          stock_status: string
        }[]
      }
      update_product_stock: {
        Args: {
          product_id: string
          quantity_change: number
          movement_type: 'in' | 'out' | 'adjustment' | 'transfer'
          reason?: string
          reference_id?: string
          reference_type?: string
        }
        Returns: {
          success: boolean
          new_stock: number
          message: string
        }
      }
      generate_inventory_report: {
        Args: {
          start_date?: string
          end_date?: string
          category_filter?: string
          supplier_filter?: string
        }
        Returns: {
          product_id: string
          product_name: string
          sku: string
          category_name: string
          supplier_name: string
          current_stock: number
          min_stock: number
          stock_value: number
          total_movements: number
          last_movement_date: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
