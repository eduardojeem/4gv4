/**
 * DIAGNÓSTICO DE COLUMNAS DE STOCK - Ejecutar en consola del navegador
 * Verifica qué columnas de stock existen y tienen datos
 */

console.log('🔍 DIAGNOSTICANDO COLUMNAS DE STOCK...');

async function diagnosticarColumnasStock() {
    try {
        // Importar Supabase
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            'https://cswtugmwazxdktntndpy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        console.log('📋 1. PROBANDO CONSULTA CON stock_quantity...');
        
        // Probar consulta con stock_quantity
        const { data: withStockQuantity, error: errorStockQuantity } = await supabase
            .from('products')
            .select('id, name, sku, stock_quantity, is_active')
            .limit(3);
        
        if (errorStockQuantity) {
            console.error('❌ Error con stock_quantity:', errorStockQuantity.message);
        } else {
            console.log('✅ Consulta con stock_quantity exitosa');
            console.log('📦 Productos encontrados:', withStockQuantity?.length || 0);
            if (withStockQuantity && withStockQuantity.length > 0) {
                console.log('📋 Ejemplo de producto:');
                console.log('  - Nombre:', withStockQuantity[0].name);
                console.log('  - SKU:', withStockQuantity[0].sku);
                console.log('  - Stock Quantity:', withStockQuantity[0].stock_quantity);
                console.log('  - Is Active:', withStockQuantity[0].is_active);
            }
        }
        
        console.log('📋 2. PROBANDO CONSULTA CON stock...');
        
        // Probar consulta con stock
        const { data: withStock, error: errorStock } = await supabase
            .from('products')
            .select('id, name, sku, stock')
            .limit(3);
        
        if (errorStock) {
            console.error('❌ Error con stock:', errorStock.message);
            console.log('💡 La columna "stock" no existe, usando "stock_quantity"');
        } else {
            console.log('✅ Consulta con stock exitosa');
            console.log('📦 Productos encontrados:', withStock?.length || 0);
        }
        
        console.log('📋 3. PROBANDO CONSULTA COMPLETA (como usePOSProducts)...');
        
        // Probar consulta completa como la usa el hook
        const { data: fullQuery, error: fullError } = await supabase
            .from('products')
            .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
            .order('name')
            .limit(10);
        
        if (fullError) {
            console.error('❌ Error en consulta completa:', fullError.message);
        } else {
            console.log('✅ Consulta completa exitosa');
            console.log('📦 Productos encontrados:', fullQuery?.length || 0);
            
            if (fullQuery && fullQuery.length > 0) {
                console.log('📊 ANÁLISIS DE PRODUCTOS:');
                const activos = fullQuery.filter(p => p.is_active === true).length;
                const inactivos = fullQuery.filter(p => p.is_active === false).length;
                const conStock = fullQuery.filter(p => p.stock_quantity > 0).length;
                const sinStock = fullQuery.filter(p => p.stock_quantity === 0).length;
                
                console.log(`  - Total: ${fullQuery.length}`);
                console.log(`  - Activos: ${activos}`);
                console.log(`  - Inactivos: ${inactivos}`);
                console.log(`  - Con stock: ${conStock}`);
                console.log(`  - Sin stock: ${sinStock}`);
                
                console.log('📋 PRIMEROS 3 PRODUCTOS:');
                fullQuery.slice(0, 3).forEach((p, i) => {
                    console.log(`  ${i+1}. ${p.name}`);
                    console.log(`     - SKU: ${p.sku}`);
                    console.log(`     - Stock: ${p.stock_quantity}`);
                    console.log(`     - Activo: ${p.is_active}`);
                    console.log(`     - Precio: ${p.sale_price}`);
                });
            }
        }
        
        console.log('🎉 DIAGNÓSTICO COMPLETADO');
        
        // Resumen
        if (!errorStockQuantity && !fullError) {
            console.log('✅ RESULTADO: La columna "stock_quantity" funciona correctamente');
            console.log('💡 El hook usePOSProducts debería funcionar sin problemas');
        } else {
            console.log('❌ RESULTADO: Hay problemas con las columnas de stock');
            console.log('💡 Ejecuta la migración 20250106_fix_stock_columns.sql');
        }
        
    } catch (error) {
        console.error('💥 ERROR GENERAL:', error);
    }
}

// Ejecutar diagnóstico automáticamente
diagnosticarColumnasStock();

console.log('💡 FUNCIÓN DISPONIBLE:');
console.log('  - diagnosticarColumnasStock() - Ejecutar diagnóstico completo');