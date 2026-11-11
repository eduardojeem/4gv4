import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import type { AppRole } from '@/lib/auth/role-utils'
import { listAccessibleBranchesForUser } from '@/lib/branches/server'
import { logger } from '@/lib/logger'
import { ORDER_STATUS_META } from '@/lib/orders/constants'
import { canTransitionOrderStatus, normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizeOrder } from '@/lib/orders/helpers'
import { emitOrderStatusSideEffects } from '@/lib/orders/status-side-effects'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().max(1000).optional().nullable(),
})

export const PATCH = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { user, organization }) => {
  try {
    const validation = bulkStatusSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const ids = Array.from(new Set(validation.data.ids))
    const targetStatus = validation.data.status
    const note = validation.data.note || null

    const supabase = await createClient()
    const adminSupabase = createAdminSupabase()

    const { data: rows, error: fetchError } = await supabase
      .from('customer_orders')
      .select('id, order_number, status, fulfillment_type, branch_id, store_credit_reserved, total, stock_reserved, customer_name, customer_email')
      .eq('organization_id', organization.id)
      .in('id', ids)

    if (fetchError) throw fetchError

    const orders = (rows ?? []) as Array<{
      id: string
      order_number: string
      status: string
      fulfillment_type: 'PICKUP' | 'DELIVERY'
      branch_id: string | null
      store_credit_reserved: number | null
      total: number | null
      stock_reserved: boolean | null
      customer_name: string | null
      customer_email: string | null
    }>

    const isOrgWideRole =
      user.role === 'super_admin'
      || organization.role === 'owner'
      || organization.role === 'admin'
    let accessibleBranchSet: Set<string> | null = null
    if (!isOrgWideRole) {
      const accessible = await listAccessibleBranchesForUser({
        userId: user.id,
        role: user.role as AppRole | undefined,
        organizationId: organization.id,
      })
      accessibleBranchSet = new Set(accessible.map((branch) => branch.id))
    }

    const rowMap = new Map(orders.map((row) => [row.id, row]))
    const updatedIds: string[] = []
    const skipped: Array<{ id: string; orderNumber: string; reason: string }> = []

    for (const id of ids) {
      const current = rowMap.get(id)
      if (!current) {
        skipped.push({ id, orderNumber: id.slice(0, 8), reason: 'Pedido no encontrado.' })
        continue
      }

      if (accessibleBranchSet && current.branch_id && !accessibleBranchSet.has(current.branch_id)) {
        skipped.push({ id, orderNumber: current.order_number, reason: 'Sin acceso a la sucursal del pedido.' })
        continue
      }

      const currentStatus = normalizeOrderStatus(current.status)
      if (currentStatus === targetStatus) {
        skipped.push({ id, orderNumber: current.order_number, reason: 'Ya se encuentra en ese estado.' })
        continue
      }

      if (!canTransitionOrderStatus(currentStatus, targetStatus, current.fulfillment_type)) {
        const fromLabel = ORDER_STATUS_META[currentStatus]?.label ?? currentStatus
        const toLabel = ORDER_STATUS_META[targetStatus]?.label ?? targetStatus
        skipped.push({ id, orderNumber: current.order_number, reason: `No puede pasar de ${fromLabel} a ${toLabel}.` })
        continue
      }

      try {
        if (targetStatus === 'CANCELLED') {
          const { error: cancellationError } = await adminSupabase.rpc('cancel_customer_order_atomic', {
            p_organization_id: organization.id,
            p_order_id: id,
            p_actor_id: user.id,
            p_note: note,
          })

          if (cancellationError) {
            logger.warn('Bulk cancel atomic fallback triggered', { error: cancellationError, orderId: id })
            await adminSupabase
              .from('customer_store_credit_reservations')
              .update({ status: 'released', released_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('organization_id', organization.id)
              .eq('order_id', id)
              .eq('status', 'reserved')

            if (current.stock_reserved) {
              const { data: items } = await adminSupabase
                .from('customer_order_items')
                .select('product_id, variant_id, quantity')
                .eq('order_id', id)
              if (items && items.length > 0) {
                const productIds = [...new Set(items.map((item) => item.product_id).filter((pid): pid is string => Boolean(pid)))]
                const { data: productsMeta } = productIds.length > 0
                  ? await adminSupabase
                      .from('products')
                      .select('id, sku, unit_measure, stock_quantity, category:categories(name)')
                      .eq('organization_id', organization.id)
                      .in('id', productIds)
                  : { data: [] }
                const productMetaMap = new Map(
                  ((productsMeta ?? []) as Array<{
                    id: string
                    sku?: string | null
                    unit_measure?: string | null
                    stock_quantity?: number | null
                    category?: { name?: string | null } | null
                  }>).map((row) => [String(row.id), row])
                )

                for (const item of items) {
                  const qty = Number(item.quantity || 0)
                  if (qty <= 0) continue
                  const productMeta = item.product_id ? productMetaMap.get(String(item.product_id)) : undefined
                  if (productMeta && isServiceLikeProduct(productMeta)) continue
                  if (item.variant_id) {
                    if (current.branch_id) {
                      const { data: branchVariant } = await adminSupabase
                        .from('branch_variant_inventory')
                        .select('stock_quantity')
                        .eq('organization_id', organization.id)
                        .eq('branch_id', current.branch_id)
                        .eq('variant_id', item.variant_id)
                        .maybeSingle()
                      if (branchVariant) {
                        await adminSupabase
                          .from('branch_variant_inventory')
                          .update({ stock_quantity: Number(branchVariant.stock_quantity || 0) + qty, updated_at: new Date().toISOString() })
                          .eq('organization_id', organization.id)
                          .eq('branch_id', current.branch_id)
                          .eq('variant_id', item.variant_id)
                        continue
                      }
                    }
                    const { data: variant } = await adminSupabase
                      .from('product_variants')
                      .select('stock_quantity')
                      .eq('id', item.variant_id)
                      .eq('organization_id', organization.id)
                      .maybeSingle()
                    if (variant) {
                      await adminSupabase
                        .from('product_variants')
                        .update({ stock_quantity: (variant.stock_quantity || 0) + qty })
                        .eq('id', item.variant_id)
                    }
                  } else if (item.product_id && current.branch_id && (!productMeta || productMeta.stock_quantity != null)) {
                    const { data: inv } = await adminSupabase
                      .from('branch_inventory')
                      .select('stock_quantity')
                      .eq('branch_id', current.branch_id)
                      .eq('product_id', item.product_id)
                      .maybeSingle()
                    if (inv) {
                      await adminSupabase
                        .from('branch_inventory')
                        .update({ stock_quantity: Number(inv.stock_quantity || 0) + qty, updated_at: new Date().toISOString() })
                        .eq('branch_id', current.branch_id)
                        .eq('product_id', item.product_id)
                    }
                  }
                }
              }
            }

            const { error: directCancelErr } = await adminSupabase
              .from('customer_orders')
              .update({
                status: 'CANCELLED',
                cancelled_at: new Date().toISOString(),
                stock_reserved: false,
                store_credit_reserved: 0,
                updated_at: new Date().toISOString(),
              })
              .eq('id', id)
              .eq('organization_id', organization.id)
            if (directCancelErr) throw directCancelErr

            await adminSupabase.from('customer_order_status_history').insert({
              organization_id: organization.id,
              order_id: id,
              from_status: current.status,
              to_status: 'CANCELLED',
              note,
              changed_by: user.id,
            })
          }
        } else if (targetStatus === 'CONFIRMED') {
          const { error: confirmationError } = await adminSupabase.rpc('confirm_customer_order_from_pending_atomic', {
            p_organization_id: organization.id,
            p_order_id: id,
            p_actor_id: user.id,
            p_note: note,
          })
          if (confirmationError) {
            logger.warn('Bulk confirm atomic fallback triggered', { error: confirmationError, orderId: id })
            const reservedCredit = Number(current.store_credit_reserved || 0)
            let appliedAmount = 0
            if (reservedCredit > 0) {
              const { data: reservation } = await adminSupabase
                .from('customer_store_credit_reservations')
                .select('*')
                .eq('organization_id', organization.id)
                .eq('order_id', id)
                .eq('status', 'reserved')
                .maybeSingle()
              if (reservation) {
                appliedAmount = Number(reservation.amount || 0)
                await adminSupabase.from('customer_store_credits').insert({
                  organization_id: organization.id,
                  customer_id: reservation.customer_id,
                  amount: -appliedAmount,
                  reason: `Aplicado al pedido ${current.order_number}`,
                  source_type: 'order',
                  source_id: id,
                  created_by: user.id,
                })
                await adminSupabase
                  .from('customer_store_credit_reservations')
                  .update({ status: 'consumed', consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                  .eq('id', reservation.id)
              }
            }
            const newPaymentStatus = appliedAmount >= Number(current.total || 0)
              ? 'PAID'
              : appliedAmount > 0
                ? 'PARTIAL'
                : undefined
            const updatePayload: Record<string, unknown> = {
              status: 'CONFIRMED',
              store_credit_reserved: 0,
              store_credit_applied: appliedAmount,
              updated_at: new Date().toISOString(),
            }
            if (newPaymentStatus) updatePayload.payment_status = newPaymentStatus
            const { error: directConfirmErr } = await adminSupabase
              .from('customer_orders')
              .update(updatePayload)
              .eq('id', id)
              .eq('organization_id', organization.id)
            if (directConfirmErr) throw directConfirmErr

            await adminSupabase.from('customer_order_status_history').insert({
              organization_id: organization.id,
              order_id: id,
              from_status: current.status,
              to_status: 'CONFIRMED',
              note: note || 'Pedido confirmado desde acción masiva.',
              changed_by: user.id,
            })
          }
        } else {
          const { error: advanceError } = await adminSupabase.rpc('advance_customer_order_status_atomic', {
            p_organization_id: organization.id,
            p_order_id: id,
            p_actor_id: user.id,
            p_to_status: targetStatus,
            p_note: note,
          })
          if (advanceError) {
            logger.warn('Bulk advance atomic fallback triggered', { error: advanceError, orderId: id })
            const updatePayload: Record<string, unknown> = {
              status: targetStatus,
              updated_at: new Date().toISOString(),
            }
            if (targetStatus === 'DELIVERED') {
              updatePayload.delivered_at = new Date().toISOString()
            }
            const { error: directAdvanceErr } = await adminSupabase
              .from('customer_orders')
              .update(updatePayload)
              .eq('id', id)
              .eq('organization_id', organization.id)
            if (directAdvanceErr) throw directAdvanceErr

            await adminSupabase.from('customer_order_status_history').insert({
              organization_id: organization.id,
              order_id: id,
              from_status: current.status,
              to_status: targetStatus,
              note,
              changed_by: user.id,
            })
          }
        }

        updatedIds.push(id)
        emitOrderStatusSideEffects({
          organization,
          actorUserId: user.id,
          previousStatus: currentStatus,
          order: current,
          targetStatus,
          note,
        })
      } catch (err) {
        logger.warn('Bulk status update failed for order', { error: err, orderId: id, targetStatus })
        skipped.push({
          id,
          orderNumber: current.order_number,
          reason: err instanceof Error ? err.message : 'Error al actualizar estado.',
        })
      }
    }

    let updatedOrders: ReturnType<typeof normalizeOrder>[] = []
    if (updatedIds.length > 0) {
      const { data: refreshed, error: refreshError } = await supabase
        .from('customer_orders')
        .select('*, order_items:customer_order_items(*)')
        .eq('organization_id', organization.id)
        .in('id', updatedIds)
      if (refreshError) throw refreshError
      updatedOrders = (refreshed ?? []).map((row) => normalizeOrder(row))
    }

    return NextResponse.json({
      success: true,
      data: {
        updated: updatedOrders,
        skipped,
      },
    })
  } catch (error) {
    logger.error('Orders bulk status API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron actualizar los pedidos seleccionados.' }, { status: 500 })
  }
})
