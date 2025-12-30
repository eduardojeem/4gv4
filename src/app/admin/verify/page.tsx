'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface TableCheck {
    name: string
    exists: boolean
    columns?: string[]
    error?: string
}

export default function SupabaseVerificationPage() {
    const [checking, setChecking] = useState(false)
    const [results, setResults] = useState<TableCheck[]>([])
    const [error, setError] = useState<string | null>(null)

    const checkTables = async () => {
        setChecking(true)
        setError(null)
        setResults([])

        try {
            const supabase = createClient()
            const checks: TableCheck[] = []

            // Helper para verificar tabla
            const checkTable = async (tableName: string) => {
                try {
                    const { error } = await supabase
                        .from(tableName)
                        .select('*')
                        .limit(1)
                    
                    return {
                        name: tableName,
                        exists: !error,
                        error: error?.message
                    }
                } catch (e: unknown) {
                    return {
                        name: tableName,
                        exists: false,
                        error: e instanceof Error ? e.message : String(e)
                    }
                }
            }

            // Tablas Core
            checks.push(await checkTable('profiles'))
            checks.push(await checkTable('user_roles'))
            checks.push(await checkTable('audit_log'))
            
            // Tablas Productos
            checks.push(await checkTable('products'))
            checks.push(await checkTable('categories'))
            checks.push(await checkTable('suppliers'))
            checks.push(await checkTable('brands'))
            checks.push(await checkTable('inventory_movements'))

            // Check auth.users access
            try {
                const { data: { user }, error } = await supabase.auth.getUser()
                checks.push({
                    name: 'auth.users (current user)',
                    exists: !error && !!user,
                    error: error?.message
                })
            } catch (e: unknown) {
                checks.push({
                    name: 'auth.users',
                    exists: false,
                    error: e instanceof Error ? e.message : String(e)
                })
            }

            setResults(checks)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setChecking(false)
        }
    }

    const loadSampleData = async () => {
        setChecking(true)
        setError(null)
        try {
            const supabase = createClient()

            const insertIfEmpty = async (table: string, rows: unknown[]) => {
                const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
                if (!count || count === 0) {
                    await supabase.from(table).insert(rows as Record<string, unknown>[])            
                }
            }

            await insertIfEmpty('categories', [
                { name: 'Smartphones', description: 'Teléfonos inteligentes y dispositivos móviles', is_active: true },
                { name: 'Accesorios', description: 'Accesorios para dispositivos móviles', is_active: true },
                { name: 'Repuestos', description: 'Repuestos y componentes para reparaciones', is_active: true },
                { name: 'Tablets', description: 'Tabletas y dispositivos de pantalla grande', is_active: true }
            ])

            await insertIfEmpty('suppliers', [
                { name: 'Apple Inc.', contact_name: 'John Smith', contact_email: 'orders@apple.com', phone: '+1-800-APL-CARE', address: 'Cupertino, CA', is_active: true },
                { name: 'Samsung', contact_name: 'Maria Garcia', contact_email: 'b2b@samsung.com', phone: '+1-800-SAMSUNG', address: 'Richardson, TX', is_active: true }
            ])

            await insertIfEmpty('brands', [
                { name: 'Apple', description: 'Tecnología innovadora y diseño premium', website: 'https://www.apple.com', is_active: true },
                { name: 'Samsung', description: 'Líder mundial en tecnología móvil', website: 'https://www.samsung.com', is_active: true }
            ])

            const { data: catSmart } = await supabase.from('categories').select('id').eq('name', 'Smartphones').maybeSingle()
            const { data: catAcc } = await supabase.from('categories').select('id').eq('name', 'Accesorios').maybeSingle()
            const { data: supApple } = await supabase.from('suppliers').select('id').eq('name', 'Apple Inc.').maybeSingle()
            const { data: supSamsung } = await supabase.from('suppliers').select('id').eq('name', 'Samsung').maybeSingle()

            await insertIfEmpty('products', [
                {
                    sku: 'IPH15PRO001', name: 'iPhone 15 Pro', description: 'Smartphone Apple iPhone 15 Pro 128GB',
                    category_id: catSmart?.id ?? null, brand: 'Apple', supplier_id: supApple?.id ?? null,
                    purchase_price: 999000, sale_price: 1299000, stock_quantity: 15, min_stock: 5,
                    unit_measure: 'unidad', is_active: true, featured: true
                },
                {
                    sku: 'SMG-S24U-001', name: 'Samsung Galaxy S24 Ultra', description: 'Samsung Galaxy S24 Ultra 256GB',
                    category_id: catSmart?.id ?? null, brand: 'Samsung', supplier_id: supSamsung?.id ?? null,
                    purchase_price: 799000, sale_price: 1099000, stock_quantity: 20, min_stock: 5,
                    unit_measure: 'unidad', is_active: true, featured: true
                },
                {
                    sku: 'ACC-USB-C-001', name: 'Cargador USB-C 30W', description: 'Cargador rápido USB-C 30W',
                    category_id: catAcc?.id ?? null, brand: 'TechCorp', supplier_id: supSamsung?.id ?? null,
                    purchase_price: 9900, sale_price: 19900, stock_quantity: 100, min_stock: 20,
                    unit_measure: 'unidad', is_active: true
                }
            ])

            const { data: productIphone } = await supabase.from('products').select('id, stock_quantity').eq('sku', 'IPH15PRO001').maybeSingle()
            if (productIphone?.id) {
                await insertIfEmpty('product_movements', [
                    {
                        product_id: productIphone.id,
                        movement_type: 'in', quantity: 10,
                        previous_stock: productIphone.stock_quantity,
                        new_stock: productIphone.stock_quantity + 10,
                        unit_cost: 999000, reason: 'Compra inicial', reference_id: 'PO-0001', reference_type: 'purchase_order'
                    },
                    {
                        product_id: productIphone.id,
                        movement_type: 'out', quantity: 2,
                        previous_stock: productIphone.stock_quantity + 10,
                        new_stock: productIphone.stock_quantity + 8,
                        unit_cost: 1299000, reason: 'Venta mostrador', reference_id: 'SALE-0001', reference_type: 'sale'
                    }
                ])

                await insertIfEmpty('product_price_history', [
                    {
                        product_id: productIphone.id,
                        old_purchase_price: 999000, new_purchase_price: 949000,
                        old_sale_price: 1299000, new_sale_price: 1249000,
                        reason: 'Ajuste de precios por campaña'
                    }
                ])
            }

            const { data: productCharger } = await supabase.from('products').select('id').eq('sku', 'ACC-USB-C-001').maybeSingle()
            if (productCharger?.id) {
                await insertIfEmpty('product_alerts', [
                    { product_id: productCharger.id, alert_type: 'low_stock', message: 'Stock bajo para Cargador USB-C 30W', is_resolved: false }
                ])
            }

            await checkTables()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setChecking(false)
        }
    }
    useEffect(() => {
        checkTables()
    }, [])

    return (
        <div className="container mx-auto p-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Verificación de Tablas de Supabase</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-muted-foreground">
                            Verificando estructura de base de datos
                        </p>
                        <Button onClick={checkTables} disabled={checking}>
                            {checking ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                'Verificar de nuevo'
                            )}
                        </Button>
                        <Button onClick={loadSampleData} disabled={checking} variant="secondary">
                            {checking ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Cargando datos...
                                </>
                            ) : (
                                'Cargar datos de ejemplo'
                            )}
                        </Button>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-red-800">
                                <XCircle className="h-5 w-5" />
                                <span className="font-semibold">Error de conexión</span>
                            </div>
                            <p className="text-sm text-red-600 mt-2">{error}</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {results.map((check) => (
                            <div
                                key={check.name}
                                className={`border rounded-lg p-4 ${check.exists
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-red-50 border-red-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {check.exists ? (
                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <XCircle className="h-5 w-5 text-red-600" />
                                        )}
                                        <div>
                                            <p className="font-semibold">{check.name}</p>
                                            {check.error && (
                                                <p className="text-sm text-red-600 mt-1">{check.error}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span
                                        className={`text-sm font-medium ${check.exists ? 'text-green-600' : 'text-red-600'
                                            }`}
                                    >
                                        {check.exists ? 'Existe' : 'No encontrada'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Mostrar instrucciones si faltan tablas */}
                    {results.some(r => !r.exists) && (
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h3 className="font-semibold text-yellow-900 mb-2">Instrucciones de Configuración</h3>
                            <p className="text-sm text-yellow-800 mb-4">
                                Se han detectado tablas faltantes. Por favor ejecuta el siguiente script SQL en el Dashboard de Supabase:
                            </p>
                            <p className="text-xs text-yellow-700 mb-2">
                                El script se encuentra en: <code className="bg-yellow-100 px-1 rounded">src/lib/supabase/products_setup.sql</code>
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
