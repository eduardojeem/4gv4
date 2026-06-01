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
      after_sales_cases: {
        Row: {
          id: string
          case_number: string | null
          source_type: string
          request_type: string
          status: string
          customer_id: string | null
          repair_id: string | null
          sale_id: string | null
          sale_item_id: string | null
          product_id: string | null
          quantity: number
          reason: string
          notes: string | null
          refund_amount: number | null
          approved_at: string | null
          resolved_at: string | null
          created_by: string | null
          resolved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          case_number?: string | null
          source_type: string
          request_type: string
          status: string
          customer_id?: string | null
          repair_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
          product_id?: string | null
          quantity: number
          reason: string
          notes?: string | null
          refund_amount?: number | null
          approved_at?: string | null
          resolved_at?: string | null
          created_by?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          case_number?: string | null
          source_type?: string
          request_type?: string
          status?: string
          customer_id?: string | null
          repair_id?: string | null
          sale_id?: string | null
          sale_item_id?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string
          notes?: string | null
          refund_amount?: number | null
          approved_at?: string | null
          resolved_at?: string | null
          created_by?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          id: string
          type: string
          title: string
          description: string
          impact: string
          confidence: number
          suggested_action: string
          affected_customers: number
          potential_revenue: number | null
          metadata: Json | null
          is_active: boolean
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          type: string
          title: string
          description: string
          impact: string
          confidence: number
          suggested_action: string
          affected_customers: number
          potential_revenue?: number | null
          metadata?: Json | null
          is_active: boolean
          created_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          type?: string
          title?: string
          description?: string
          impact?: string
          confidence?: number
          suggested_action?: string
          affected_customers?: number
          potential_revenue?: number | null
          metadata?: Json | null
          is_active?: boolean
          created_at?: string | null
          expires_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string | null
          severity: string | null
          resource: string
          new_values: Json | null
          old_values: Json | null
          branch_id: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
          severity?: string | null
          resource: string
          new_values?: Json | null
          old_values?: Json | null
          branch_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
          severity?: string | null
          resource?: string
          new_values?: Json | null
          old_values?: Json | null
          branch_id?: string | null
        }
        Relationships: []
      }
      authorized_persons: {
        Row: {
          id: string
          profile_id: string
          full_name: string
          document_number: string
          phone: string | null
          relationship: string | null
          is_active: boolean | null
          organization_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          full_name: string
          document_number: string
          phone?: string | null
          relationship?: string | null
          is_active?: boolean | null
          organization_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          full_name?: string
          document_number?: string
          phone?: string | null
          relationship?: string | null
          is_active?: boolean | null
          organization_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          trigger_type: string
          trigger_config: Json
          action_type: string
          action_config: Json
          is_active: boolean
          last_executed: string | null
          execution_count: number
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          trigger_type: string
          trigger_config: Json
          action_type: string
          action_config: Json
          is_active: boolean
          last_executed?: string | null
          execution_count: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          trigger_type?: string
          trigger_config?: Json
          action_type?: string
          action_config?: Json
          is_active?: boolean
          last_executed?: string | null
          execution_count?: number
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      branch_inventory: {
        Row: {
          branch_id: string
          product_id: string
          stock_quantity: number
          reserved_quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          product_id: string
          stock_quantity: number
          reserved_quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          product_id?: string
          stock_quantity?: number
          reserved_quantity?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          id: string
          code: string
          name: string
          slug: string
          address: string | null
          city: string | null
          phone: string | null
          email: string | null
          manager_name: string | null
          is_active: boolean
          is_default: boolean
          metadata: Json
          created_at: string
          updated_at: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          slug: string
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          manager_name?: string | null
          is_active: boolean
          is_default: boolean
          metadata: Json
          created_at?: string
          updated_at?: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          slug?: string
          address?: string | null
          city?: string | null
          phone?: string | null
          email?: string | null
          manager_name?: string | null
          is_active?: boolean
          is_default?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          name: string
          description: string | null
          website: string | null
          country: string | null
          founded_year: number | null
          logo_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          website?: string | null
          country?: string | null
          founded_year?: number | null
          logo_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          website?: string | null
          country?: string | null
          founded_year?: number | null
          logo_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      cash_admin_audit: {
        Row: {
          id: string
          session_id: string | null
          register_id: string
          action: string
          performed_by: string
          reason: string | null
          metadata: Json | null
          previous_state: Json | null
          new_state: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          register_id: string
          action: string
          performed_by: string
          reason?: string | null
          metadata?: Json | null
          previous_state?: Json | null
          new_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          register_id?: string
          action?: string
          performed_by?: string
          reason?: string | null
          metadata?: Json | null
          previous_state?: Json | null
          new_state?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      cash_alerts: {
        Row: {
          id: string
          session_id: string | null
          register_id: string
          alert_type: string
          severity: string
          title: string
          description: string | null
          metadata: Json | null
          is_read: boolean | null
          is_resolved: boolean | null
          resolved_by: string | null
          resolved_at: string | null
          resolution_note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          register_id: string
          alert_type: string
          severity: string
          title: string
          description?: string | null
          metadata?: Json | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          register_id?: string
          alert_type?: string
          severity?: string
          title?: string
          description?: string | null
          metadata?: Json | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      cash_closures: {
        Row: {
          id: string
          type: string
          register_id: string
          date: string | null
          opening_balance: number | null
          closing_balance: number | null
          income_total: number | null
          expense_total: number | null
          sales_total_cash: number | null
          sales_total_card: number | null
          sales_total_transfer: number | null
          sales_total_mixed: number | null
          movements_count: number | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          discrepancy: number | null
          expected_balance: number | null
          opened_by: string | null
          closed_by: string | null
          status: string | null
          suspended_by: string | null
          suspended_at: string | null
          blocked_by: string | null
          blocked_at: string | null
          last_activity_at: string | null
          branch_id: string
        }
        Insert: {
          id?: string
          type: string
          register_id: string
          date?: string | null
          opening_balance?: number | null
          closing_balance?: number | null
          income_total?: number | null
          expense_total?: number | null
          sales_total_cash?: number | null
          sales_total_card?: number | null
          sales_total_transfer?: number | null
          sales_total_mixed?: number | null
          movements_count?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          discrepancy?: number | null
          expected_balance?: number | null
          opened_by?: string | null
          closed_by?: string | null
          status?: string | null
          suspended_by?: string | null
          suspended_at?: string | null
          blocked_by?: string | null
          blocked_at?: string | null
          last_activity_at?: string | null
          branch_id: string
        }
        Update: {
          id?: string
          type?: string
          register_id?: string
          date?: string | null
          opening_balance?: number | null
          closing_balance?: number | null
          income_total?: number | null
          expense_total?: number | null
          sales_total_cash?: number | null
          sales_total_card?: number | null
          sales_total_transfer?: number | null
          sales_total_mixed?: number | null
          movements_count?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          discrepancy?: number | null
          expected_balance?: number | null
          opened_by?: string | null
          closed_by?: string | null
          status?: string | null
          suspended_by?: string | null
          suspended_at?: string | null
          blocked_by?: string | null
          blocked_at?: string | null
          last_activity_at?: string | null
          branch_id?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          id: string
          register_id: string | null
          type: 'apertura' | 'venta' | 'ingreso' | 'egreso' | 'cierre' | 'cash_in' | 'cash_out' | 'sale' | 'opening' | 'closing'
          amount: number
          note: string | null
          created_by: string | null
          timestamp: string | null
          session_id: string | null
          payment_method: string | null
          created_at: string | null
          reason: string | null
          branch_id: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          register_id?: string | null
          type: 'apertura' | 'venta' | 'ingreso' | 'egreso' | 'cierre' | 'cash_in' | 'cash_out' | 'sale' | 'opening' | 'closing'
          amount: number
          note?: string | null
          created_by?: string | null
          timestamp?: string | null
          session_id?: string | null
          payment_method?: string | null
          created_at?: string | null
          reason?: string | null
          branch_id: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          register_id?: string | null
          type?: 'apertura' | 'venta' | 'ingreso' | 'egreso' | 'cierre' | 'cash_in' | 'cash_out' | 'sale' | 'opening' | 'closing'
          amount?: number
          note?: string | null
          created_by?: string | null
          timestamp?: string | null
          session_id?: string | null
          payment_method?: string | null
          created_at?: string | null
          reason?: string | null
          branch_id?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      cash_register_config: {
        Row: {
          id: string
          register_id: string
          max_open_hours: number | null
          max_discrepancy_amount: number | null
          max_withdrawals_per_session: number | null
          max_voids_per_session: number | null
          inactivity_threshold_minutes: number | null
          high_balance_threshold: number | null
          requires_approval_for_close: boolean | null
          requires_dual_control: boolean | null
          auto_suspend_on_discrepancy: boolean | null
          updated_by: string | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          register_id: string
          max_open_hours?: number | null
          max_discrepancy_amount?: number | null
          max_withdrawals_per_session?: number | null
          max_voids_per_session?: number | null
          inactivity_threshold_minutes?: number | null
          high_balance_threshold?: number | null
          requires_approval_for_close?: boolean | null
          requires_dual_control?: boolean | null
          auto_suspend_on_discrepancy?: boolean | null
          updated_by?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          register_id?: string
          max_open_hours?: number | null
          max_discrepancy_amount?: number | null
          max_withdrawals_per_session?: number | null
          max_voids_per_session?: number | null
          inactivity_threshold_minutes?: number | null
          high_balance_threshold?: number | null
          requires_approval_for_close?: boolean | null
          requires_dual_control?: boolean | null
          auto_suspend_on_discrepancy?: boolean | null
          updated_by?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          id: string
          name: string
          is_open: boolean | null
          balance: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          branch_id: string
        }
        Insert: {
          id?: string
          name: string
          is_open?: boolean | null
          balance?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          branch_id: string
        }
        Update: {
          id?: string
          name?: string
          is_open?: boolean | null
          balance?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          branch_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          parent_id: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          parent_id?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      communication_messages: {
        Row: {
          id: string
          repair_id: string | null
          channel: string
          content: string
          sent_at: string | null
          status: string
          direction: string
          template_id: string | null
          created_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          repair_id?: string | null
          channel: string
          content: string
          sent_at?: string | null
          status: string
          direction: string
          template_id?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          repair_id?: string | null
          channel?: string
          content?: string
          sent_at?: string | null
          status?: string
          direction?: string
          template_id?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      credit_details: {
        Row: {
          id: string | null
          customer_id: string | null
          sale_id: string | null
          principal: number | null
          interest_rate: number | null
          term_months: number | null
          start_date: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
          customer_name: string | null
        }
        Insert: {
          id?: string | null
          customer_id?: string | null
          sale_id?: string | null
          principal?: number | null
          interest_rate?: number | null
          term_months?: number | null
          start_date?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          customer_name?: string | null
        }
        Update: {
          id?: string | null
          customer_id?: string | null
          sale_id?: string | null
          principal?: number | null
          interest_rate?: number | null
          term_months?: number | null
          start_date?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          customer_name?: string | null
        }
        Relationships: []
      }
      credit_installments: {
        Row: {
          id: string
          credit_id: string
          installment_number: number
          due_date: string
          amount: number
          principal_component: number
          interest_component: number
          status: string
          paid_at: string | null
          payment_method: string | null
          amount_paid: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          credit_id: string
          installment_number: number
          due_date: string
          amount: number
          principal_component: number
          interest_component: number
          status: string
          paid_at?: string | null
          payment_method?: string | null
          amount_paid?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          credit_id?: string
          installment_number?: number
          due_date?: string
          amount?: number
          principal_component?: number
          interest_component?: number
          status?: string
          paid_at?: string | null
          payment_method?: string | null
          amount_paid?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_installments_progress: {
        Row: {
          id: string | null
          progreso: number | null
          status_effective: string | null
        }
        Insert: {
          id?: string | null
          progreso?: number | null
          status_effective?: string | null
        }
        Update: {
          id?: string | null
          progreso?: number | null
          status_effective?: string | null
        }
        Relationships: []
      }
      credit_payments: {
        Row: {
          id: string
          credit_id: string
          installment_id: string | null
          amount: number
          payment_method: string | null
          created_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          credit_id: string
          installment_id?: string | null
          amount: number
          payment_method?: string | null
          created_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          credit_id?: string
          installment_id?: string | null
          amount?: number
          payment_method?: string | null
          created_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      credit_summary: {
        Row: {
          credit_id: string | null
          total_principal: number | null
          total_installments: number | null
          total_pagado: number | null
          saldo_pendiente: number | null
          progreso: number | null
        }
        Insert: {
          credit_id?: string | null
          total_principal?: number | null
          total_installments?: number | null
          total_pagado?: number | null
          saldo_pendiente?: number | null
          progreso?: number | null
        }
        Update: {
          credit_id?: string | null
          total_principal?: number | null
          total_installments?: number | null
          total_pagado?: number | null
          saldo_pendiente?: number | null
          progreso?: number | null
        }
        Relationships: []
      }
      customer_credits: {
        Row: {
          id: string
          customer_id: string
          sale_id: string | null
          principal: number
          interest_rate: number
          term_months: number
          start_date: string
          status: string
          created_at: string | null
          updated_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          sale_id?: string | null
          principal: number
          interest_rate: number
          term_months: number
          start_date: string
          status: string
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          sale_id?: string | null
          principal?: number
          interest_rate?: number
          term_months?: number
          start_date?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      customer_order_items: {
        Row: {
          id: string
          organization_id: string
          order_id: string
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          order_id: string
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          unit_price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          unit_price?: number
          subtotal?: number
          created_at?: string
        }
        Relationships: []
      }
      customer_order_status_history: {
        Row: {
          id: string
          organization_id: string
          order_id: string
          from_status: string | null
          to_status: string
          note: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          order_id: string
          from_status?: string | null
          to_status: string
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          order_id?: string
          from_status?: string | null
          to_status?: string
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customer_order_payment_history: {
        Row: {
          id: string
          organization_id: string
          order_id: string
          from_status: string | null
          to_status: string
          payment_method: string | null
          amount: number | null
          note: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          order_id: string
          from_status?: string | null
          to_status: string
          payment_method?: string | null
          amount?: number | null
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          order_id?: string
          from_status?: string | null
          to_status?: string
          payment_method?: string | null
          amount?: number | null
          note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customer_orders: {
        Row: {
          id: string
          organization_id: string
          customer_id: string | null
          order_number: string
          status: string
          payment_status: string
          payment_method: string
          fulfillment_type: string
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          customer_address: string | null
          subtotal: number
          tax_amount: number
          shipping_cost: number
          discount_amount: number
          total: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          estimated_delivery_date: string | null
          delivered_at: string | null
          cancelled_at: string | null
          stock_reserved: boolean
        }
        Insert: {
          id?: string
          organization_id: string
          customer_id?: string | null
          order_number: string
          status: string
          payment_status: string
          payment_method: string
          fulfillment_type: string
          customer_name: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          subtotal: number
          tax_amount: number
          shipping_cost: number
          discount_amount: number
          total: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          estimated_delivery_date?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          stock_reserved?: boolean
        }
        Update: {
          id?: string
          organization_id?: string
          customer_id?: string | null
          order_number?: string
          status?: string
          payment_status?: string
          payment_method?: string
          fulfillment_type?: string
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string | null
          customer_address?: string | null
          subtotal?: number
          tax_amount?: number
          shipping_cost?: number
          discount_amount?: number
          total?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          estimated_delivery_date?: string | null
          delivered_at?: string | null
          cancelled_at?: string | null
          stock_reserved?: boolean
        }
        Relationships: []
      }
      customer_segments: {
        Row: {
          id: string
          name: string
          description: string | null
          criteria: Json
          color: string
          icon: string
          is_active: boolean
          auto_update: boolean
          priority: number
          tags: string[] | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          criteria: Json
          color: string
          icon: string
          is_active: boolean
          auto_update: boolean
          priority: number
          tags?: string[] | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          criteria?: Json
          color?: string
          icon?: string
          is_active?: boolean
          auto_update?: boolean
          priority?: number
          tags?: string[] | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_stats: {
        Row: {
          total_customers: number | null
          active_customers: number | null
          inactive_customers: number | null
          vip_customers: number | null
          premium_customers: number | null
          avg_lifetime_value: number | null
          total_revenue: number | null
          avg_satisfaction_score: number | null
        }
        Insert: {
          total_customers?: number | null
          active_customers?: number | null
          inactive_customers?: number | null
          vip_customers?: number | null
          premium_customers?: number | null
          avg_lifetime_value?: number | null
          total_revenue?: number | null
          avg_satisfaction_score?: number | null
        }
        Update: {
          total_customers?: number | null
          active_customers?: number | null
          inactive_customers?: number | null
          vip_customers?: number | null
          premium_customers?: number | null
          avg_lifetime_value?: number | null
          total_revenue?: number | null
          avg_satisfaction_score?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          customer_code: string | null
          name: string
          email: string | null
          phone: string | null
          ruc: string | null
          customer_type: string | null
          status: string | null
          segment: string | null
          address: string | null
          city: string | null
          total_purchases: number | null
          total_repairs: number | null
          credit_score: number | null
          satisfaction_score: number | null
          lifetime_value: number | null
          avg_order_value: number | null
          loyalty_points: number | null
          credit_limit: number | null
          current_balance: number | null
          pending_amount: number | null
          discount_percentage: number | null
          last_purchase_amount: number | null
          total_spent_this_year: number | null
          purchase_frequency: string | null
          preferred_contact: string | null
          payment_terms: string | null
          notes: string | null
          whatsapp: string | null
          social_media: string | null
          company: string | null
          position: string | null
          referral_source: string | null
          assigned_salesperson: string | null
          tags: string[] | null
          created_at: string | null
          updated_at: string | null
          last_visit: string | null
          last_activity: string | null
          birthday: string | null
          registration_date: string | null
          first_name: string | null
          last_name: string | null
          profile_id: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          customer_code?: string | null
          name: string
          email?: string | null
          phone?: string | null
          ruc?: string | null
          customer_type?: string | null
          status?: string | null
          segment?: string | null
          address?: string | null
          city?: string | null
          total_purchases?: number | null
          total_repairs?: number | null
          credit_score?: number | null
          satisfaction_score?: number | null
          lifetime_value?: number | null
          avg_order_value?: number | null
          loyalty_points?: number | null
          credit_limit?: number | null
          current_balance?: number | null
          pending_amount?: number | null
          discount_percentage?: number | null
          last_purchase_amount?: number | null
          total_spent_this_year?: number | null
          purchase_frequency?: string | null
          preferred_contact?: string | null
          payment_terms?: string | null
          notes?: string | null
          whatsapp?: string | null
          social_media?: string | null
          company?: string | null
          position?: string | null
          referral_source?: string | null
          assigned_salesperson?: string | null
          tags?: string[] | null
          created_at?: string | null
          updated_at?: string | null
          last_visit?: string | null
          last_activity?: string | null
          birthday?: string | null
          registration_date?: string | null
          first_name?: string | null
          last_name?: string | null
          profile_id?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          customer_code?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          ruc?: string | null
          customer_type?: string | null
          status?: string | null
          segment?: string | null
          address?: string | null
          city?: string | null
          total_purchases?: number | null
          total_repairs?: number | null
          credit_score?: number | null
          satisfaction_score?: number | null
          lifetime_value?: number | null
          avg_order_value?: number | null
          loyalty_points?: number | null
          credit_limit?: number | null
          current_balance?: number | null
          pending_amount?: number | null
          discount_percentage?: number | null
          last_purchase_amount?: number | null
          total_spent_this_year?: number | null
          purchase_frequency?: string | null
          preferred_contact?: string | null
          payment_terms?: string | null
          notes?: string | null
          whatsapp?: string | null
          social_media?: string | null
          company?: string | null
          position?: string | null
          referral_source?: string | null
          assigned_salesperson?: string | null
          tags?: string[] | null
          created_at?: string | null
          updated_at?: string | null
          last_visit?: string | null
          last_activity?: string | null
          birthday?: string | null
          registration_date?: string | null
          first_name?: string | null
          last_name?: string | null
          profile_id?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      database_growth_snapshots: {
        Row: {
          snapshot_date: string
          total_size_bytes: number
          total_size_mb: number
          recorded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          snapshot_date: string
          total_size_bytes: number
          total_size_mb: number
          recorded_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          snapshot_date?: string
          total_size_bytes?: number
          total_size_mb?: number
          recorded_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_reorders: {
        Row: {
          id: string
          productid: string | null
          currentstock: number
          reorderpoint: number
          reorderquantity: number
          preferredsupplierid: string
          urgency: string | null
          estimatedcost: number
          status: string | null
          createdat: string | null
          processedat: string | null
        }
        Insert: {
          id?: string
          productid?: string | null
          currentstock: number
          reorderpoint: number
          reorderquantity: number
          preferredsupplierid: string
          urgency?: string | null
          estimatedcost: number
          status?: string | null
          createdat?: string | null
          processedat?: string | null
        }
        Update: {
          id?: string
          productid?: string | null
          currentstock?: number
          reorderpoint?: number
          reorderquantity?: number
          preferredsupplierid?: string
          urgency?: string | null
          estimatedcost?: number
          status?: string | null
          createdat?: string | null
          processedat?: string | null
        }
        Relationships: []
      }
      mojibake_fix_backup: {
        Row: {
          id: number
          table_name: string
          row_id: string
          column_name: string
          old_value: string
          new_value: string
          fixed_at: string
        }
        Insert: {
          id?: number
          table_name: string
          row_id: string
          column_name: string
          old_value: string
          new_value: string
          fixed_at: string
        }
        Update: {
          id?: number
          table_name?: string
          row_id?: string
          column_name?: string
          old_value?: string
          new_value?: string
          fixed_at?: string
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          token_hash: string
          invited_by: string | null
          accepted_by: string | null
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          token_hash: string
          invited_by?: string | null
          accepted_by?: string | null
          expires_at: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role?: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          token_hash?: string
          invited_by?: string | null
          accepted_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          status: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'manager' | 'cashier' | 'technician' | 'seller' | 'customer'
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          organization_id: string
          display_name: string | null
          currency: string
          timezone: string
          branding: Json
          modules: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          organization_id: string
          display_name?: string | null
          currency: string
          timezone: string
          branding: Json
          modules: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string
          display_name?: string | null
          currency?: string
          timezone?: string
          branding?: Json
          modules?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: string
          logo_url: string | null
          owner_id: string | null
          created_at: string
          updated_at: string
          marketplace_public: boolean
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan: string
          logo_url?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
          marketplace_public: boolean
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan?: string
          logo_url?: string | null
          owner_id?: string | null
          created_at?: string
          updated_at?: string
          marketplace_public?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          sale_id: string | null
          payment_method: string
          amount: number
          reference_number: string | null
          status: string | null
          created_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          sale_id?: string | null
          payment_method: string
          amount: number
          reference_number?: string | null
          status?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          sale_id?: string | null
          payment_method?: string
          amount?: number
          reference_number?: string | null
          status?: string | null
          created_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          code: string
          name: string
          limits: Json
          modules: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          code: string
          name: string
          limits: Json
          modules: string[]
          is_active: boolean
          created_at?: string
        }
        Update: {
          code?: string
          name?: string
          limits?: Json
          modules?: string[]
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          title: string
          content: string
          excerpt: string | null
          category: string | null
          tags: string[] | null
          status: string | null
          published_at: string | null
          updated_at: string | null
          created_at: string | null
          user_id: string | null
          featured: boolean | null
          image_url: string | null
          views_count: number | null
          likes_count: number | null
          comments_count: number | null
          shares_count: number | null
          read_time: number | null
        }
        Insert: {
          id?: string
          title: string
          content: string
          excerpt?: string | null
          category?: string | null
          tags?: string[] | null
          status?: string | null
          published_at?: string | null
          updated_at?: string | null
          created_at?: string | null
          user_id?: string | null
          featured?: boolean | null
          image_url?: string | null
          views_count?: number | null
          likes_count?: number | null
          comments_count?: number | null
          shares_count?: number | null
          read_time?: number | null
        }
        Update: {
          id?: string
          title?: string
          content?: string
          excerpt?: string | null
          category?: string | null
          tags?: string[] | null
          status?: string | null
          published_at?: string | null
          updated_at?: string | null
          created_at?: string | null
          user_id?: string | null
          featured?: boolean | null
          image_url?: string | null
          views_count?: number | null
          likes_count?: number | null
          comments_count?: number | null
          shares_count?: number | null
          read_time?: number | null
        }
        Relationships: []
      }
      product_alerts: {
        Row: {
          id: string
          product_id: string
          alert_type: string
          message: string
          details: Json | null
          read: boolean | null
          is_resolved: boolean | null
          resolved_at: string | null
          created_at: string | null
          branch_id: string | null
        }
        Insert: {
          id?: string
          product_id: string
          alert_type: string
          message: string
          details?: Json | null
          read?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          created_at?: string | null
          branch_id?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          alert_type?: string
          message?: string
          details?: Json | null
          read?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          created_at?: string | null
          branch_id?: string | null
        }
        Relationships: []
      }
      product_alerts_archive: {
        Row: {
          id: string
          product_id: string | null
          type: string | null
          message: string | null
          details: Json | null
          read: boolean | null
          is_resolved: boolean | null
          resolved_at: string | null
          created_at: string | null
          archived_at: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          type?: string | null
          message?: string | null
          details?: Json | null
          read?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          created_at?: string | null
          archived_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          type?: string | null
          message?: string | null
          details?: Json | null
          read?: boolean | null
          is_resolved?: boolean | null
          resolved_at?: string | null
          created_at?: string | null
          archived_at?: string | null
        }
        Relationships: []
      }
      product_movements: {
        Row: {
          id: string
          product_id: string
          movement_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          unit_cost: number | null
          total_cost: number | null
          reference_id: string | null
          reference_type: string | null
          notes: string | null
          user_id: string | null
          created_at: string | null
          branch_id: string
        }
        Insert: {
          id?: string
          product_id: string
          movement_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          unit_cost?: number | null
          total_cost?: number | null
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string | null
          branch_id: string
        }
        Update: {
          id?: string
          product_id?: string
          movement_type?: string
          quantity?: number
          previous_stock?: number
          new_stock?: number
          unit_cost?: number | null
          total_cost?: number | null
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string | null
          branch_id?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          id: string
          product_id: string
          price_type: string
          old_price: number | null
          new_price: number
          change_reason: string | null
          user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          price_type: string
          old_price?: number | null
          new_price: number
          change_reason?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          price_type?: string
          old_price?: number | null
          new_price?: number
          change_reason?: string | null
          user_id?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      product_stats: {
        Row: {
          total_products: number | null
          active_products: number | null
          total_stock_value: number | null
          total_cost_value: number | null
          total_margin: number | null
          low_stock_count: number | null
          out_of_stock_count: number | null
        }
        Insert: {
          total_products?: number | null
          active_products?: number | null
          total_stock_value?: number | null
          total_cost_value?: number | null
          total_margin?: number | null
          low_stock_count?: number | null
          out_of_stock_count?: number | null
        }
        Update: {
          total_products?: number | null
          active_products?: number | null
          total_stock_value?: number | null
          total_cost_value?: number | null
          total_margin?: number | null
          low_stock_count?: number | null
          out_of_stock_count?: number | null
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          variant_name: string
          sku: string | null
          price_adjustment: number | null
          stock_quantity: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          variant_name: string
          sku?: string | null
          price_adjustment?: number | null
          stock_quantity?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          variant_name?: string
          sku?: string | null
          price_adjustment?: number | null
          stock_quantity?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
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
          purchase_price: number | null
          sale_price: number
          wholesale_price: number | null
          offer_price: number | null
          has_offer: boolean | null
          stock_quantity: number | null
          min_stock: number | null
          max_stock: number | null
          unit_measure: string | null
          barcode: string | null
          images: string[] | null
          image_url: string | null
          weight: number | null
          dimensions: string | null
          location: string | null
          tags: string[] | null
          is_active: boolean | null
          featured: boolean | null
          created_at: string | null
          updated_at: string | null
          brand_id: string | null
          visibility: string | null
          warranty_months: number | null
          warranty_info: string | null
          return_window_days: number | null
          exchange_window_days: number | null
          return_policy: string | null
          exchange_policy: string | null
          stock_status_computed: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price: number
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          brand_id?: string | null
          visibility?: string | null
          warranty_months?: number | null
          warranty_info?: string | null
          return_window_days?: number | null
          exchange_window_days?: number | null
          return_policy?: string | null
          exchange_policy?: string | null
          stock_status_computed?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price?: number
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          brand_id?: string | null
          visibility?: string | null
          warranty_months?: number
          warranty_info?: string | null
          return_window_days?: number
          exchange_window_days?: number
          return_policy?: string | null
          exchange_policy?: string | null
          stock_status_computed?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      products_dashboard_stats: {
        Row: {
          total_products: number | null
          active_products: number | null
          inactive_products: number | null
          total_stock: number | null
          total_inventory_value: number | null
          out_of_stock_count: number | null
          low_stock_count: number | null
          no_supplier_count: number | null
          no_category_count: number | null
          no_image_count: number | null
          avg_sale_price: number | null
          avg_purchase_price: number | null
          avg_profit_margin: number | null
        }
        Insert: {
          total_products?: number | null
          active_products?: number | null
          inactive_products?: number | null
          total_stock?: number | null
          total_inventory_value?: number | null
          out_of_stock_count?: number | null
          low_stock_count?: number | null
          no_supplier_count?: number | null
          no_category_count?: number | null
          no_image_count?: number | null
          avg_sale_price?: number | null
          avg_purchase_price?: number | null
          avg_profit_margin?: number | null
        }
        Update: {
          total_products?: number | null
          active_products?: number | null
          inactive_products?: number | null
          total_stock?: number | null
          total_inventory_value?: number | null
          out_of_stock_count?: number | null
          low_stock_count?: number | null
          no_supplier_count?: number | null
          no_category_count?: number | null
          no_image_count?: number | null
          avg_sale_price?: number | null
          avg_purchase_price?: number | null
          avg_profit_margin?: number | null
        }
        Relationships: []
      }
      products_detailed: {
        Row: {
          id: string | null
          sku: string | null
          name: string | null
          description: string | null
          category_id: string | null
          brand: string | null
          supplier_id: string | null
          purchase_price: number | null
          sale_price: number | null
          wholesale_price: number | null
          offer_price: number | null
          has_offer: boolean | null
          stock_quantity: number | null
          min_stock: number | null
          max_stock: number | null
          unit_measure: string | null
          barcode: string | null
          images: string[] | null
          image_url: string | null
          weight: number | null
          dimensions: string | null
          location: string | null
          tags: string[] | null
          is_active: boolean | null
          featured: boolean | null
          created_at: string | null
          updated_at: string | null
          category_name: string | null
          category_color: string | null
          category_icon: string | null
          supplier_name: string | null
          supplier_contact: string | null
          supplier_email: string | null
          supplier_phone: string | null
          profit_margin_percentage: number | null
          total_stock_value: number | null
          stock_status: string | null
          active_alerts_count: number | null
        }
        Insert: {
          id?: string | null
          sku?: string | null
          name?: string | null
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          category_name?: string | null
          category_color?: string | null
          category_icon?: string | null
          supplier_name?: string | null
          supplier_contact?: string | null
          supplier_email?: string | null
          supplier_phone?: string | null
          profit_margin_percentage?: number | null
          total_stock_value?: number | null
          stock_status?: string | null
          active_alerts_count?: number | null
        }
        Update: {
          id?: string | null
          sku?: string | null
          name?: string | null
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          category_name?: string | null
          category_color?: string | null
          category_icon?: string | null
          supplier_name?: string | null
          supplier_contact?: string | null
          supplier_email?: string | null
          supplier_phone?: string | null
          profit_margin_percentage?: number | null
          total_stock_value?: number | null
          stock_status?: string | null
          active_alerts_count?: number | null
        }
        Relationships: []
      }
      products_full: {
        Row: {
          id: string | null
          sku: string | null
          name: string | null
          description: string | null
          category_id: string | null
          brand: string | null
          supplier_id: string | null
          purchase_price: number | null
          sale_price: number | null
          wholesale_price: number | null
          offer_price: number | null
          has_offer: boolean | null
          stock_quantity: number | null
          min_stock: number | null
          max_stock: number | null
          unit_measure: string | null
          barcode: string | null
          images: string[] | null
          image_url: string | null
          weight: number | null
          dimensions: string | null
          location: string | null
          tags: string[] | null
          is_active: boolean | null
          featured: boolean | null
          created_at: string | null
          updated_at: string | null
          category_name: string | null
          supplier_name: string | null
          stock_status: string | null
          margin: number | null
          margin_percentage: number | null
          total_value: number | null
        }
        Insert: {
          id?: string | null
          sku?: string | null
          name?: string | null
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          category_name?: string | null
          supplier_name?: string | null
          stock_status?: string | null
          margin?: number | null
          margin_percentage?: number | null
          total_value?: number | null
        }
        Update: {
          id?: string | null
          sku?: string | null
          name?: string | null
          description?: string | null
          category_id?: string | null
          brand?: string | null
          supplier_id?: string | null
          purchase_price?: number | null
          sale_price?: number | null
          wholesale_price?: number | null
          offer_price?: number | null
          has_offer?: boolean | null
          stock_quantity?: number | null
          min_stock?: number | null
          max_stock?: number | null
          unit_measure?: string | null
          barcode?: string | null
          images?: string[] | null
          image_url?: string | null
          weight?: number | null
          dimensions?: string | null
          location?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          featured?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          category_name?: string | null
          supplier_name?: string | null
          stock_status?: string | null
          margin?: number | null
          margin_percentage?: number | null
          total_value?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: string | null
          avatar_url: string | null
          phone: string | null
          email: string | null
          created_at: string | null
          updated_at: string | null
          department: string | null
          status: string | null
          bio: string | null
          website: string | null
          job_title: string | null
          timezone: string | null
          social_links: Json | null
          preferences: Json | null
          permissions: string[] | null
          location: string | null
        }
        Insert: {
          id?: string
          full_name?: string | null
          role?: string | null
          avatar_url?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
          department?: string | null
          status?: string | null
          bio?: string | null
          website?: string | null
          job_title?: string | null
          timezone?: string | null
          social_links?: Json | null
          preferences?: Json | null
          permissions?: string[] | null
          location?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: string | null
          avatar_url?: string | null
          phone?: string | null
          email?: string | null
          created_at?: string | null
          updated_at?: string | null
          department?: string | null
          status?: string | null
          bio?: string | null
          website?: string | null
          job_title?: string | null
          timezone?: string | null
          social_links?: Json | null
          preferences?: Json | null
          permissions?: string[] | null
          location?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          id: string
          name: string
          code: string
          description: string | null
          type: string
          value: number
          min_purchase: number | null
          max_discount: number | null
          start_date: string
          end_date: string
          usage_count: number | null
          usage_limit: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          applicable_products: string[] | null
          applicable_categories: string[] | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          type: string
          value: number
          min_purchase?: number | null
          max_discount?: number | null
          start_date: string
          end_date: string
          usage_count?: number | null
          usage_limit?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          applicable_products?: string[] | null
          applicable_categories?: string[] | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          type?: string
          value?: number
          min_purchase?: number | null
          max_discount?: number | null
          start_date?: string
          end_date?: string
          usage_count?: number | null
          usage_limit?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          applicable_products?: string[] | null
          applicable_categories?: string[] | null
          organization_id?: string | null
        }
        Relationships: []
      }
      promotions_carousel: {
        Row: {
          promotion_id: string
          position: number
          created_at: string
        }
        Insert: {
          promotion_id: string
          position: number
          created_at?: string
        }
        Update: {
          promotion_id?: string
          position?: number
          created_at?: string
        }
        Relationships: []
      }
      public_access_audit: {
        Row: {
          id: string
          event_type: string
          ticket_number: string
          contact_hash: string | null
          client_ip: string | null
          user_agent: string | null
          reason: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          event_type: string
          ticket_number: string
          contact_hash?: string | null
          client_ip?: string | null
          user_agent?: string | null
          reason?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          event_type?: string
          ticket_number?: string
          contact_hash?: string | null
          client_ip?: string | null
          user_agent?: string | null
          reason?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          suppliersku: string | null
          internalsku: string | null
          name: string
          quantity: number
          unitprice: number
          linetotal: number
          status: string | null
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          suppliersku?: string | null
          internalsku?: string | null
          name: string
          quantity: number
          unitprice: number
          linetotal: number
          status?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          suppliersku?: string | null
          internalsku?: string | null
          name?: string
          quantity?: number
          unitprice?: number
          linetotal?: number
          status?: string | null
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          id: string
          ordernumber: string
          supplierid: string
          suppliername: string | null
          status: string | null
          orderdate: string | null
          expecteddeliverydate: string | null
          actualdeliverydate: string | null
          subtotal: number
          taxamount: number
          shippingcost: number
          totalamount: number
          currency: string
          syncstatus: string | null
          createdat: string | null
          updatedat: string | null
        }
        Insert: {
          id?: string
          ordernumber: string
          supplierid: string
          suppliername?: string | null
          status?: string | null
          orderdate?: string | null
          expecteddeliverydate?: string | null
          actualdeliverydate?: string | null
          subtotal: number
          taxamount: number
          shippingcost: number
          totalamount: number
          currency: string
          syncstatus?: string | null
          createdat?: string | null
          updatedat?: string | null
        }
        Update: {
          id?: string
          ordernumber?: string
          supplierid?: string
          suppliername?: string | null
          status?: string | null
          orderdate?: string | null
          expecteddeliverydate?: string | null
          actualdeliverydate?: string | null
          subtotal?: number
          taxamount?: number
          shippingcost?: number
          totalamount?: number
          currency?: string
          syncstatus?: string | null
          createdat?: string | null
          updatedat?: string | null
        }
        Relationships: []
      }
      rate_limit_settings: {
        Row: {
          id: string
          user_id: string | null
          action_type: string
          attempt_count: number | null
          window_start: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          action_type: string
          attempt_count?: number | null
          window_start?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          action_type?: string
          attempt_count?: number | null
          window_start?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      repair_images: {
        Row: {
          id: string
          repair_id: string
          image_url: string
          image_type: string | null
          description: string | null
          uploaded_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          repair_id: string
          image_url: string
          image_type?: string | null
          description?: string | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          repair_id?: string
          image_url?: string
          image_type?: string | null
          description?: string | null
          uploaded_by?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      repair_notes: {
        Row: {
          id: string
          repair_id: string
          author_id: string | null
          author_name: string
          note_text: string
          is_internal: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          repair_id: string
          author_id?: string | null
          author_name: string
          note_text: string
          is_internal?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          repair_id?: string
          author_id?: string | null
          author_name?: string
          note_text?: string
          is_internal?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      repair_parts: {
        Row: {
          id: string
          repair_id: string
          product_id: string | null
          part_name: string
          part_number: string | null
          quantity: number
          unit_cost: number
          total_cost: number | null
          supplier: string | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          repair_id: string
          product_id?: string | null
          part_name: string
          part_number?: string | null
          quantity: number
          unit_cost: number
          total_cost?: number | null
          supplier?: string | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          repair_id?: string
          product_id?: string | null
          part_name?: string
          part_number?: string | null
          quantity?: number
          unit_cost?: number
          total_cost?: number | null
          supplier?: string | null
          status?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      repair_stats: {
        Row: {
          total_repairs: number | null
          pending_repairs: number | null
          in_diagnosis: number | null
          in_repair: number | null
          ready_for_pickup: number | null
          delivered: number | null
          high_priority: number | null
          urgent_repairs: number | null
          avg_repair_cost: number | null
          total_revenue: number | null
          avg_customer_rating: number | null
          avg_completion_hours: number | null
        }
        Insert: {
          total_repairs?: number | null
          pending_repairs?: number | null
          in_diagnosis?: number | null
          in_repair?: number | null
          ready_for_pickup?: number | null
          delivered?: number | null
          high_priority?: number | null
          urgent_repairs?: number | null
          avg_repair_cost?: number | null
          total_revenue?: number | null
          avg_customer_rating?: number | null
          avg_completion_hours?: number | null
        }
        Update: {
          total_repairs?: number | null
          pending_repairs?: number | null
          in_diagnosis?: number | null
          in_repair?: number | null
          ready_for_pickup?: number | null
          delivered?: number | null
          high_priority?: number | null
          urgent_repairs?: number | null
          avg_repair_cost?: number | null
          total_revenue?: number | null
          avg_customer_rating?: number | null
          avg_completion_hours?: number | null
        }
        Relationships: []
      }
      repair_status_history: {
        Row: {
          id: string
          repair_id: string
          old_status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          new_status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado'
          changed_by: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          repair_id: string
          old_status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          new_status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado'
          changed_by?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          repair_id?: string
          old_status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          new_status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado'
          changed_by?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      repairs: {
        Row: {
          id: string
          customer_id: string
          device_type: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand: string
          device_model: string
          serial_number: string | null
          imei: string | null
          problem_description: string
          diagnosis: string | null
          solution: string | null
          status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority: 'low' | 'medium' | 'high' | null
          urgency: 'normal' | 'urgent' | null
          technician_id: string | null
          estimated_cost: number | null
          final_cost: number | null
          labor_cost: number | null
          parts_cost: number | null
          location: string | null
          warranty_months: number | null
          warranty_expires_at: string | null
          created_at: string | null
          updated_at: string | null
          estimated_completion: string | null
          completed_at: string | null
          delivered_at: string | null
          progress: number | null
          customer_rating: number | null
          customer_feedback: string | null
          notify_customer: boolean | null
          notify_technician: boolean | null
          notify_manager: boolean | null
          tags: string[] | null
          metadata: Json | null
          is_deleted: boolean | null
          deleted_at: string | null
          access_type: string | null
          access_password: string | null
          received_at: string | null
          ticket_number: string | null
          warranty_type: string | null
          warranty_notes: string | null
          picked_up_at: string | null
          payment_status: string | null
          paid_amount: number | null
          delivery_outcome: string | null
          branch_id: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          customer_id: string
          device_type?: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand: string
          device_model: string
          serial_number?: string | null
          imei?: string | null
          problem_description: string
          diagnosis?: string | null
          solution?: string | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority?: 'low' | 'medium' | 'high' | null
          urgency?: 'normal' | 'urgent' | null
          technician_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          labor_cost?: number | null
          parts_cost?: number | null
          location?: string | null
          warranty_months?: number | null
          warranty_expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          progress?: number | null
          customer_rating?: number | null
          customer_feedback?: string | null
          notify_customer?: boolean | null
          notify_technician?: boolean | null
          notify_manager?: boolean | null
          tags?: string[] | null
          metadata?: Json | null
          is_deleted?: boolean | null
          deleted_at?: string | null
          access_type?: string | null
          access_password?: string | null
          received_at?: string | null
          ticket_number?: string | null
          warranty_type?: string | null
          warranty_notes?: string | null
          picked_up_at?: string | null
          payment_status?: string | null
          paid_amount?: number | null
          delivery_outcome?: string | null
          branch_id: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          customer_id?: string
          device_type?: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand?: string
          device_model?: string
          serial_number?: string | null
          imei?: string | null
          problem_description?: string
          diagnosis?: string | null
          solution?: string | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority?: 'low' | 'medium' | 'high' | null
          urgency?: 'normal' | 'urgent' | null
          technician_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          labor_cost?: number | null
          parts_cost?: number | null
          location?: string | null
          warranty_months?: number | null
          warranty_expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          progress?: number | null
          customer_rating?: number | null
          customer_feedback?: string | null
          notify_customer?: boolean | null
          notify_technician?: boolean | null
          notify_manager?: boolean | null
          tags?: string[] | null
          metadata?: Json | null
          is_deleted?: boolean | null
          deleted_at?: string | null
          access_type?: string | null
          access_password?: string | null
          received_at?: string | null
          ticket_number?: string | null
          warranty_type?: string | null
          warranty_notes?: string | null
          picked_up_at?: string | null
          payment_status?: string | null
          paid_amount?: number | null
          delivery_outcome?: string | null
          branch_id?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      repairs_full: {
        Row: {
          id: string | null
          customer_id: string | null
          device_type: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand: string | null
          device_model: string | null
          serial_number: string | null
          imei: string | null
          problem_description: string | null
          diagnosis: string | null
          solution: string | null
          status: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority: 'low' | 'medium' | 'high' | null
          urgency: 'normal' | 'urgent' | null
          technician_id: string | null
          estimated_cost: number | null
          final_cost: number | null
          labor_cost: number | null
          parts_cost: number | null
          location: string | null
          warranty_months: number | null
          warranty_expires_at: string | null
          created_at: string | null
          updated_at: string | null
          estimated_completion: string | null
          completed_at: string | null
          delivered_at: string | null
          progress: number | null
          customer_rating: number | null
          customer_feedback: string | null
          notify_customer: boolean | null
          notify_technician: boolean | null
          notify_manager: boolean | null
          tags: string[] | null
          metadata: Json | null
          is_deleted: boolean | null
          deleted_at: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_email: string | null
          technician_name: string | null
          technician_email: string | null
          cost_variance: number | null
          hours_in_repair: number | null
          notes_count: number | null
          parts_count: number | null
          images_count: number | null
        }
        Insert: {
          id?: string | null
          customer_id?: string | null
          device_type?: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand?: string | null
          device_model?: string | null
          serial_number?: string | null
          imei?: string | null
          problem_description?: string | null
          diagnosis?: string | null
          solution?: string | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority?: 'low' | 'medium' | 'high' | null
          urgency?: 'normal' | 'urgent' | null
          technician_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          labor_cost?: number | null
          parts_cost?: number | null
          location?: string | null
          warranty_months?: number | null
          warranty_expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          progress?: number | null
          customer_rating?: number | null
          customer_feedback?: string | null
          notify_customer?: boolean | null
          notify_technician?: boolean | null
          notify_manager?: boolean | null
          tags?: string[] | null
          metadata?: Json | null
          is_deleted?: boolean | null
          deleted_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          technician_name?: string | null
          technician_email?: string | null
          cost_variance?: number | null
          hours_in_repair?: number | null
          notes_count?: number | null
          parts_count?: number | null
          images_count?: number | null
        }
        Update: {
          id?: string | null
          customer_id?: string | null
          device_type?: 'smartphone' | 'tablet' | 'laptop' | 'desktop' | 'accessory' | 'other' | null
          device_brand?: string | null
          device_model?: string | null
          serial_number?: string | null
          imei?: string | null
          problem_description?: string | null
          diagnosis?: string | null
          solution?: string | null
          status?: 'recibido' | 'diagnostico' | 'reparacion' | 'listo' | 'entregado' | 'cancelado' | 'pausado' | null
          priority?: 'low' | 'medium' | 'high' | null
          urgency?: 'normal' | 'urgent' | null
          technician_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          labor_cost?: number | null
          parts_cost?: number | null
          location?: string | null
          warranty_months?: number | null
          warranty_expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          estimated_completion?: string | null
          completed_at?: string | null
          delivered_at?: string | null
          progress?: number | null
          customer_rating?: number | null
          customer_feedback?: string | null
          notify_customer?: boolean | null
          notify_technician?: boolean | null
          notify_manager?: boolean | null
          tags?: string[] | null
          metadata?: Json | null
          is_deleted?: boolean | null
          deleted_at?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_email?: string | null
          technician_name?: string | null
          technician_email?: string | null
          cost_variance?: number | null
          hours_in_repair?: number | null
          notes_count?: number | null
          parts_count?: number | null
          images_count?: number | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string | null
          product_id: string | null
          quantity: number
          unit_price: number
          discount_amount: number | null
          subtotal: number
          created_at: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          sale_id?: string | null
          product_id?: string | null
          quantity: number
          unit_price: number
          discount_amount?: number | null
          subtotal: number
          created_at?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          sale_id?: string | null
          product_id?: string | null
          quantity?: number
          unit_price?: number
          discount_amount?: number | null
          subtotal?: number
          created_at?: string | null
          organization_id?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          id: string
          code: string
          total_amount: number
          subtotal_amount: number
          tax_amount: number | null
          discount_amount: number | null
          payment_method: string
          payment_status: string | null
          status: string | null
          customer_id: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          branch_id: string
          organization_id: string | null
        }
        Insert: {
          id?: string
          code: string
          total_amount: number
          subtotal_amount: number
          tax_amount?: number | null
          discount_amount?: number | null
          payment_method: string
          payment_status?: string | null
          status?: string | null
          customer_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          branch_id: string
          organization_id?: string | null
        }
        Update: {
          id?: string
          code?: string
          total_amount?: number
          subtotal_amount?: number
          tax_amount?: number | null
          discount_amount?: number | null
          payment_method?: string
          payment_status?: string | null
          status?: string | null
          customer_id?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          branch_id?: string
          organization_id?: string | null
        }
        Relationships: []
      }
      segment_analytics: {
        Row: {
          id: string
          segment_id: string
          customer_count: number
          total_revenue: number
          avg_order_value: number
          conversion_rate: number
          growth_rate: number
          retention_rate: number
          engagement_score: number
          last_calculated: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          segment_id: string
          customer_count: number
          total_revenue: number
          avg_order_value: number
          conversion_rate: number
          growth_rate: number
          retention_rate: number
          engagement_score: number
          last_calculated?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          segment_id?: string
          customer_count?: number
          total_revenue?: number
          avg_order_value?: number
          conversion_rate?: number
          growth_rate?: number
          retention_rate?: number
          engagement_score?: number
          last_calculated?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      segment_history: {
        Row: {
          id: string
          segment_id: string
          action: string
          changes: Json | null
          previous_values: Json | null
          performed_by: string | null
          performed_at: string | null
        }
        Insert: {
          id?: string
          segment_id: string
          action: string
          changes?: Json | null
          previous_values?: Json | null
          performed_by?: string | null
          performed_at?: string | null
        }
        Update: {
          id?: string
          segment_id?: string
          action?: string
          changes?: Json | null
          previous_values?: Json | null
          performed_by?: string | null
          performed_at?: string | null
        }
        Relationships: []
      }
      settings_change_history: {
        Row: {
          id: string | null
          created_at: string | null
          field_name: string | null
          old_value: Json | null
          new_value: Json | null
          severity: string | null
          changed_by: string | null
          changed_by_email: string | null
        }
        Insert: {
          id?: string | null
          created_at?: string | null
          field_name?: string | null
          old_value?: Json | null
          new_value?: Json | null
          severity?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
        }
        Update: {
          id?: string | null
          created_at?: string | null
          field_name?: string | null
          old_value?: Json | null
          new_value?: Json | null
          severity?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          tier: string
          name: string
          price: number
          price_note: string | null
          description: string | null
          is_popular: boolean
          is_active: boolean
          limits: Json
          highlights: Json
          features: Json
          color_config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tier: string
          name: string
          price: number
          price_note?: string | null
          description?: string | null
          is_popular: boolean
          is_active: boolean
          limits: Json
          highlights: Json
          features: Json
          color_config: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tier?: string
          name?: string
          price?: number
          price_note?: string | null
          description?: string | null
          is_popular?: boolean
          is_active?: boolean
          limits?: Json
          highlights?: Json
          features?: Json
          color_config?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan: string
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          trial_ends_at: string | null
          current_period_starts_at: string | null
          current_period_ends_at: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          plan: string
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          trial_ends_at?: string | null
          current_period_starts_at?: string | null
          current_period_ends_at?: string | null
          cancel_at_period_end: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          plan?: string
          status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          trial_ends_at?: string | null
          current_period_starts_at?: string | null
          current_period_ends_at?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          id: string
          supplier_id: string
          suppliersku: string | null
          internalsku: string | null
          name: string
          description: string | null
          category: string | null
          unitprice: number
          currency: string
          minimumorderquantity: number
          leadtimedays: number
          availability: string | null
          lastupdated: string | null
          syncstatus: string | null
        }
        Insert: {
          id?: string
          supplier_id: string
          suppliersku?: string | null
          internalsku?: string | null
          name: string
          description?: string | null
          category?: string | null
          unitprice: number
          currency: string
          minimumorderquantity: number
          leadtimedays: number
          availability?: string | null
          lastupdated?: string | null
          syncstatus?: string | null
        }
        Update: {
          id?: string
          supplier_id?: string
          suppliersku?: string | null
          internalsku?: string | null
          name?: string
          description?: string | null
          category?: string | null
          unitprice?: number
          currency?: string
          minimumorderquantity?: number
          leadtimedays?: number
          availability?: string | null
          lastupdated?: string | null
          syncstatus?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          tax_id: string | null
          created_at: string | null
          updated_at: string | null
          status: string | null
          business_type: string | null
          city: string | null
          country: string | null
          postal_code: string | null
          website: string | null
          rating: number | null
          notes: string | null
          is_active: boolean
          organization_id: string | null
        }
        Insert: {
          id?: string
          name: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          status?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          website?: string | null
          rating?: number | null
          notes?: string | null
          is_active: boolean
          organization_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          tax_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          status?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          website?: string | null
          rating?: number | null
          notes?: string | null
          is_active?: boolean
          organization_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          company_name: string
          company_email: string
          company_phone: string
          company_address: string | null
          currency: string
          tax_rate: number
          low_stock_threshold: number
          session_timeout: number
          auto_backup: boolean
          email_notifications: boolean
          sms_notifications: boolean
          maintenance_mode: boolean
          allow_registration: boolean
          require_email_verification: boolean
          max_login_attempts: number
          password_min_length: number
          require_two_factor: boolean
          created_at: string | null
          updated_at: string | null
          updated_by: string | null
          city: string | null
          theme: string | null
          primary_color: string | null
          date_format: string | null
          time_zone: string | null
          language: string | null
          items_per_page: number | null
          social_links: Json | null
          features: Json | null
          retention_days: number | null
          company_ruc: string | null
        }
        Insert: {
          id?: string
          company_name: string
          company_email: string
          company_phone: string
          company_address?: string | null
          currency: string
          tax_rate: number
          low_stock_threshold: number
          session_timeout: number
          auto_backup: boolean
          email_notifications: boolean
          sms_notifications: boolean
          maintenance_mode: boolean
          allow_registration: boolean
          require_email_verification: boolean
          max_login_attempts: number
          password_min_length: number
          require_two_factor: boolean
          created_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          city?: string | null
          theme?: string | null
          primary_color?: string | null
          date_format?: string | null
          time_zone?: string | null
          language?: string | null
          items_per_page?: number | null
          social_links?: Json | null
          features?: Json | null
          retention_days?: number | null
          company_ruc?: string | null
        }
        Update: {
          id?: string
          company_name?: string
          company_email?: string
          company_phone?: string
          company_address?: string | null
          currency?: string
          tax_rate?: number
          low_stock_threshold?: number
          session_timeout?: number
          auto_backup?: boolean
          email_notifications?: boolean
          sms_notifications?: boolean
          maintenance_mode?: boolean
          allow_registration?: boolean
          require_email_verification?: boolean
          max_login_attempts?: number
          password_min_length?: number
          require_two_factor?: boolean
          created_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
          city?: string | null
          theme?: string | null
          primary_color?: string | null
          date_format?: string | null
          time_zone?: string | null
          language?: string | null
          items_per_page?: number | null
          social_links?: Json | null
          features?: Json | null
          retention_days?: number | null
          company_ruc?: string | null
        }
        Relationships: []
      }
      system_settings_audit: {
        Row: {
          id: string
          user_id: string | null
          user_email: string | null
          action: string
          field_name: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          user_agent: string | null
          severity: string | null
          details: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action: string
          field_name?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          severity?: string | null
          details?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action?: string
          field_name?: string | null
          old_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          severity?: string | null
          details?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      technician_workload: {
        Row: {
          technician_id: string | null
          technician_name: string | null
          total_repairs: number | null
          active_repairs: number | null
          completed_repairs: number | null
          avg_rating: number | null
          total_revenue: number | null
          avg_completion_hours: number | null
        }
        Insert: {
          technician_id?: string | null
          technician_name?: string | null
          total_repairs?: number | null
          active_repairs?: number | null
          completed_repairs?: number | null
          avg_rating?: number | null
          total_revenue?: number | null
          avg_completion_hours?: number | null
        }
        Update: {
          technician_id?: string | null
          technician_name?: string | null
          total_repairs?: number | null
          active_repairs?: number | null
          completed_repairs?: number | null
          avg_rating?: number | null
          total_revenue?: number | null
          avg_completion_hours?: number | null
        }
        Relationships: []
      }
      tenant_audit_log: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: string
          resource: string
          resource_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: string
          resource: string
          resource_id?: string | null
          metadata: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action?: string
          resource?: string
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_branch_assignments: {
        Row: {
          id: string
          user_id: string
          branch_id: string
          is_primary: boolean
          is_active: boolean
          assigned_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          branch_id: string
          is_primary: boolean
          is_active: boolean
          assigned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          branch_id?: string
          is_primary?: boolean
          is_active?: boolean
          assigned_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string | null
          permission: string
          granted_by: string | null
          granted_at: string | null
          expires_at: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          permission: string
          granted_by?: string | null
          granted_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          permission?: string
          granted_by?: string | null
          granted_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string | null
          role: string
          assigned_by: string | null
          assigned_at: string | null
          expires_at: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          role: string
          assigned_by?: string | null
          assigned_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: string
          assigned_by?: string | null
          assigned_at?: string | null
          expires_at?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_security_settings: {
        Row: {
          id: string
          user_id: string
          two_factor_enabled: boolean | null
          email_notifications: boolean | null
          login_alerts: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          two_factor_enabled?: boolean | null
          email_notifications?: boolean | null
          login_alerts?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          two_factor_enabled?: boolean | null
          email_notifications?: boolean | null
          login_alerts?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          session_id: string
          user_agent: string | null
          ip_address: string | null
          device_type: string | null
          browser: string | null
          os: string | null
          country: string | null
          city: string | null
          is_active: boolean | null
          last_activity: string | null
          created_at: string | null
          ended_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          user_agent?: string | null
          ip_address?: string | null
          device_type?: string | null
          browser?: string | null
          os?: string | null
          country?: string | null
          city?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          created_at?: string | null
          ended_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          user_agent?: string | null
          ip_address?: string | null
          device_type?: string | null
          browser?: string | null
          os?: string | null
          country?: string | null
          city?: string | null
          is_active?: boolean | null
          last_activity?: string | null
          created_at?: string | null
          ended_at?: string | null
        }
        Relationships: []
      }
      user_stats_cache: {
        Row: {
          total_users: number | null
          active_users: number | null
          inactive_users: number | null
          admins_count: number | null
          new_users_this_month: number | null
          last_update: string | null
        }
        Insert: {
          total_users?: number | null
          active_users?: number | null
          inactive_users?: number | null
          admins_count?: number | null
          new_users_this_month?: number | null
          last_update?: string | null
        }
        Update: {
          total_users?: number | null
          active_users?: number | null
          inactive_users?: number | null
          admins_count?: number | null
          new_users_this_month?: number | null
          last_update?: string | null
        }
        Relationships: []
      }
      variant_attribute_options: {
        Row: {
          id: string
          attribute_id: string
          value: string
          display_value: string | null
          color_hex: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          attribute_id: string
          value: string
          display_value?: string | null
          color_hex?: string | null
          sort_order: number
          is_active: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          attribute_id?: string
          value?: string
          display_value?: string | null
          color_hex?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      variant_attributes: {
        Row: {
          id: string
          name: string
          type: string
          required: boolean
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          required: boolean
          sort_order: number
          is_active: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          required?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_settings: {
        Row: {
          id: string
          key: string
          value: Json
          created_at: string | null
          updated_at: string
          updated_by: string | null
          organization_id: string | null
        }
        Insert: {
          id?: string
          key: string
          value: Json
          created_at?: string | null
          updated_at?: string
          updated_by?: string | null
          organization_id?: string | null
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          created_at?: string | null
          updated_at?: string
          updated_by?: string | null
          organization_id?: string | null
        }
        Relationships: []
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
