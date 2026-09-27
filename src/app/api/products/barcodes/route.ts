import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { assignInternalBarcodes } from '@/lib/labels/internal-barcode'

/**
 * Le pone código de barras propio a los productos que no tienen.
 *
 * Sin código, la etiqueta se imprime con el SKU como Code 128, y los SKU
 * autogenerados tienen 18 caracteres o más: en el rollo de 50 × 25 las barras
 * salen por debajo de 0,19 mm y el lector no las toma. Un EAN-13 son 95
 * módulos fijos y se lee en cualquier etiqueta.
 */

const BodySchema = z.object({
  productIds: z.array(z.string().uuid()).min(1, 'Elegí al menos un producto').max(200),
})

export const POST = withTenantAuth(
  { permission: 'products.update', module: 'inventory' },
  async (request, { user, organization }) => {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? 'Pedido inválido' },
        { status: 400 },
      )
    }

    const admin = createAdminSupabase()

    try {
      // Solo los productos de esta organización: el id viene del navegador.
      const { data: products, error } = await admin
        .from('products')
        .select('id, name, barcode')
        .eq('organization_id', organization.id)
        .in('id', parsed.data.productIds)

      if (error) throw error

      const pending = (products ?? []).filter((product) => !(product.barcode ?? '').trim())
      if (pending.length === 0) {
        return NextResponse.json({ success: true, data: { assigned: [], alreadyHad: (products ?? []).length } })
      }

      // Los códigos que ya están en uso en la organización, productos y
      // variantes: dos etiquetas con el mismo código cobran el producto
      // equivocado en el mostrador.
      const [{ data: usedProducts }, { data: usedVariants }] = await Promise.all([
        admin.from('products').select('barcode').eq('organization_id', organization.id).not('barcode', 'is', null),
        admin.from('product_variants').select('barcode').eq('organization_id', organization.id).not('barcode', 'is', null),
      ])

      const taken = new Set(
        [...(usedProducts ?? []), ...(usedVariants ?? [])]
          .map((row) => (row.barcode ?? '').trim())
          .filter(Boolean),
      )

      const { assignments, failed } = assignInternalBarcodes(pending, taken)

      const saved: { id: string; barcode: string }[] = []
      let skipped = 0

      for (const assignment of assignments) {
        const { data: updated, error: updateError } = await admin
          .from('products')
          .update({ barcode: assignment.barcode, updated_at: new Date().toISOString() })
          .eq('id', assignment.id)
          .eq('organization_id', organization.id)
          // Nunca sobrescribe uno existente, ni uno que alguien cargó mientras
          // esto corría. En la base, «sin código» se guarda como NULL.
          .is('barcode', null)
          .select('id')

        if (updateError) {
          logger.error('No se pudo guardar el código de barras', {
            error: updateError.message,
            productId: assignment.id,
            organizationId: organization.id,
          })
          skipped += 1
          continue
        }

        if (!updated || updated.length === 0) {
          skipped += 1
          continue
        }
        saved.push(assignment)
      }

      logger.info('Códigos de barras generados', {
        organizationId: organization.id,
        userId: user.id,
        assigned: saved.length,
        failed: failed.length + skipped,
      })

      return NextResponse.json({
        success: true,
        data: {
          assigned: saved,
          alreadyHad: (products ?? []).length - pending.length,
          failed: failed.length + skipped,
        },
      })
    } catch (err) {
      logger.error('Falló la generación de códigos de barras', {
        error: err instanceof Error ? err.message : String(err),
        organizationId: organization.id,
      })
      return NextResponse.json(
        { success: false, error: 'No se pudieron generar los códigos' },
        { status: 500 },
      )
    }
  },
)
