import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { productsHaveDeviceColumns } from '@/lib/products/device-columns'
import { buildDeviceOptions } from '@/lib/products/device-options'
import { mergeCatalogIntoOptions, resolveGlobalDeviceModelBrand, type GlobalDeviceModel } from '@/lib/devices/global-models'

/**
 * Marcas y modelos de celular para elegir de una lista.
 *
 * Si cada uno escribe el modelo a mano vuelve a pasar lo de siempre: «iphone
 * 13», «Iphone 13» y «IPHONE 13» como tres modelos. Las sugerencias salen de
 * dos lugares: lo que ya se cargó en productos y lo que el taller ya anotó en
 * las reparaciones, que guardan marca y modelo de cada equipo que entra.
 */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const admin = createAdminSupabase()
    const conColumnas = await productsHaveDeviceColumns(admin as never)
    // Para filtrar el listado sólo sirve lo que tiene algún producto: sugerir un
    // modelo que sólo aparece en reparaciones daría una lista vacía.
    const soloProductos = new URL(request.url).searchParams.get('scope') === 'products'

    const [productos, reparaciones] = await Promise.all([
      conColumnas
        ? admin
            .from('products')
            .select('device_brand, device_models')
            .eq('organization_id', organization.id)
            .not('device_brand', 'is', null)
            .limit(5000)
        : Promise.resolve({ data: [] as Array<{ device_brand: string | null; device_models: string[] | null }> }),
      soloProductos
        ? Promise.resolve({ data: [] as Array<{ device_brand: string | null; device_model: string | null }> })
        : admin
            .from('repairs')
            .select('device_brand, device_model')
            .eq('organization_id', organization.id)
            .limit(5000),
    ])

    const propias = buildDeviceOptions({
      productos: (productos.data ?? []) as Array<{ device_brand: string | null; device_models: string[] | null }>,
      reparaciones: (reparaciones.data ?? []) as Array<{ device_brand: string | null; device_model: string | null }>,
    })

    // El catálogo global de la plataforma se suma después de lo propio, así una
    // tienda nueva no arranca con la lista vacía. Para filtrar no: un modelo
    // que la tienda no tiene daría un listado vacío. Sin la tabla, solo lo propio.
    let opciones = propias
    if (!soloProductos) {
      const { data: catalogo, error: catalogoError } = await admin
        .from('global_device_models')
        .select('id, global_brand_id, brand, model, device_type, aliases, release_year, is_active, global_brands(name)')
        .eq('is_active', true)
        .eq('catalog_status', 'published')
        .limit(5000)
      if (!catalogoError && catalogo) {
        const models = (catalogo as unknown as GlobalDeviceModel[]).map((item) => ({
          ...item,
          brand: resolveGlobalDeviceModelBrand(item),
        }))
        opciones = mergeCatalogIntoOptions(propias, models)
      }
    }

    return NextResponse.json({ success: true, data: { ...opciones, columnsReady: conColumnas } })
  } catch (error) {
    logger.error('device options failed', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar las marcas y modelos.' }, { status: 500 })
  }
})
