import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import type { AppRole } from '@/lib/auth/role-utils'
import { canUseCatalogRecord } from '@/lib/organization/business-experience'
import { resolveLabelCode } from '@/lib/labels/barcode-format'
import { serverBarcodeSvg } from '@/lib/labels/server-barcode-svg'
import { buildLabelSheetHtml } from '@/lib/labels/label-sheet'
import { layoutOrDefault } from '@/lib/labels/label-layouts'
import { rateScannability } from '@/lib/labels/scannability'
const query = z.object({
  paper: z.enum(['A4', '58mm', '80mm']).default('A4'),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
})
export const GET = withTenantAuth(
  { permission: 'products.read', module: ['inventory', 'services'] },
  async (request: NextRequest, { user, organization }, routeContext) => {
    try {
      const { id } = await (routeContext as { params: Promise<{ id: string }> }).params
      const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams))
      if (!z.string().uuid().safeParse(id).success || !parsed.success)
        return NextResponse.json(
          { error: 'Revisá el producto, papel y cantidad (1 a 100).' },
          { status: 400 },
        )
      try {
        await resolveBranchScopeForUser({
          userId: user.id,
          role: user.role as AppRole,
          organizationId: organization.id,
          requestedBranchId: getRequestedBranchId(request),
          strict: true,
        })
      } catch {
        return NextResponse.json(
          { error: 'No tenés acceso a la sucursal seleccionada.' },
          { status: 403 },
        )
      }
      const db = createAdminSupabase()
      const { data: product, error } = await db
        .from('products')
        .select('id, name, sku, barcode, unit_measure')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle()
      if (error)
        return NextResponse.json({ error: 'No pudimos consultar el producto.' }, { status: 500 })
      if (!product)
        return NextResponse.json(
          { error: 'Producto no encontrado en este negocio.' },
          { status: 404 },
        )
      if (!canUseCatalogRecord(organization.catalogServicesOnly, product))
        return NextResponse.json({ error: 'Sin acceso a este tipo de producto.' }, { status: 403 })
      const code = resolveLabelCode(product)
      if (!code)
        return NextResponse.json(
          {
            error:
              'Este producto no tiene un código de barras o SKU imprimible. Agregalo antes de imprimir.',
          },
          { status: 422 },
        )
      const layout = layoutOrDefault(
        parsed.data.paper === 'A4'
          ? 'a4-24'
          : parsed.data.paper === '80mm'
            ? 'termica-80mm'
            : 'termica-50x25',
      )
      if (rateScannability(code.value, layout, code.format)?.level === 'risky')
        return NextResponse.json(
          { error: 'El código es muy largo para esta etiqueta. Elegí rollo de 80 mm.' },
          { status: 422 },
        )
      const label = {
        productId: product.id,
        name: product.name,
        code: code.value,
        sku: product.sku,
        priceLabel: null,
        barcodeSvg: serverBarcodeSvg(code.value, code.format),
      }
      const html = buildLabelSheetHtml(
        Array.from({ length: parsed.data.quantity }, () => label),
        layout,
        {
          showName: true,
          showCode: true,
          showPrice: false,
          showSku: true,
          showStoreName: true,
          storeName: organization.name,
        },
      )
      return NextResponse.json(
        {
          html,
          width: (layout.pageWidthMm * 72) / 25.4,
          ...(layout.pageHeightMm ? { height: (layout.pageHeightMm * 72) / 25.4 } : {}),
        },
        { headers: { 'Cache-Control': 'private, no-store' } },
      )
    } catch {
      return NextResponse.json(
        {
          error:
            'No pudimos preparar las etiquetas. Revisá el acceso a la sucursal y volvé a intentar.',
        },
        { status: 500 },
      )
    }
  },
)
