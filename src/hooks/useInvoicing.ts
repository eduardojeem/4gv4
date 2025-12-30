'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface Invoice {
    id: string
    invoice_number: string
    sale_id: string
    customer_id?: string
    customer_name?: string
    customer_email?: string
    pdf_url?: string
    status: 'draft' | 'sent' | 'paid' | 'cancelled'
    sent_at?: string
    created_at: string
}

export function useInvoicing() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(false)

    const supabase = createClient()

    // Generate invoice number
    const generateInvoiceNumber = () => {
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const timestamp = Date.now().toString().slice(-6)
        return `INV-${year}${month}-${timestamp}`
    }

    // Create invoice
    const createInvoice = useCallback(async (saleId: string) => {
        try {
            setLoading(true)

            // Get sale data
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .select(`
          *,
          sale_items (
            *,
            products (name, sku)
          )
        `)
                .eq('id', saleId)
                .single()

            if (saleError) throw saleError

            // Get customer data if exists
            let customerData = null
            if (sale.customer_id) {
                const { data: customer } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', sale.customer_id)
                    .single()

                customerData = customer
            }

            const invoiceNumber = generateInvoiceNumber()

            // Create invoice record
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .insert({
                    invoice_number: invoiceNumber,
                    sale_id: saleId,
                    customer_id: sale.customer_id,
                    status: 'draft',
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (invoiceError) throw invoiceError

            toast.success('Factura creada')
            return invoice
        } catch (error: unknown) {
            console.error('Error creating invoice:', error)
            toast.error('Error al crear factura')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    // Generate PDF
    const generatePDF = useCallback(async (invoiceId: string) => {
        try {
            setLoading(true)

            // Get invoice with full data
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select(`
          *,
          sales (
            *,
            sale_items (
              *,
              products (name, sku)
            )
          )
        `)
                .eq('id', invoiceId)
                .single()

            if (error) throw error

            // Here you would integrate with a PDF generation service
            // For now, we'll just create a placeholder URL
            const pdfUrl = `/api/invoices/${invoice.invoice_number}.pdf`

            // Update invoice with PDF URL
            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    pdf_url: pdfUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', invoiceId)

            if (updateError) throw updateError

            toast.success('PDF generado')
            return pdfUrl
        } catch (error: unknown) {
            console.error('Error generating PDF:', error)
            toast.error('Error al generar PDF')
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    // Send invoice by email
    const sendInvoice = useCallback(async (invoiceId: string, email: string) => {
        try {
            setLoading(true)

            // Get invoice data
            const { data: invoice, error: fetchError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .single()

            if (fetchError) throw fetchError

            if (!invoice.pdf_url) {
                toast.error('Primero genera el PDF')
                return false
            }

            // Here you would integrate with an email service
            // For now, we'll just update the status

            const { error: updateError } = await supabase
                .from('invoices')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', invoiceId)

            if (updateError) throw updateError

            toast.success(`Factura enviada a ${email}`)
            return true
        } catch (error: unknown) {
            console.error('Error sending invoice:', error)
            toast.error('Error al enviar factura')
            return false
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch invoices
    const fetchInvoices = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error

            setInvoices(data || [])
        } catch (error: unknown) {
            console.error('Error fetching invoices:', error)
            toast.error('Error al cargar facturas')
        }
    }, [])

    // Cancel invoice
    const cancelInvoice = useCallback(async (invoiceId: string) => {
        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', invoiceId)

            if (error) throw error

            toast.success('Factura cancelada')
            await fetchInvoices()
        } catch (error: unknown) {
            console.error('Error cancelling invoice:', error)
            toast.error('Error al cancelar factura')
        }
    }, [fetchInvoices])

    useEffect(() => {
        fetchInvoices()
    }, [fetchInvoices])

    return {
        invoices,
        loading,
        createInvoice,
        generatePDF,
        sendInvoice,
        cancelInvoice,
        refresh: fetchInvoices
    }
}
