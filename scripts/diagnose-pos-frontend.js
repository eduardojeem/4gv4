/**
 * DIAGNÓSTICO FRONTEND: Productos POS
 * Ejecutar en la consola del navegador en la página de POS
 */

console.log('🔍 INICIANDO DIAGNÓSTICO DE PRODUCTOS POS...');

// 1. Verificar configuración de Supabase
console.log('📋 1. CONFIGURACIÓN SUPABASE:');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NO CONFIGURADA');
console.log('ANON KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA');

// 2. Verificar cliente Supabase
const { createClient } = require('@/lib/supabase/client');
const supabase = createClient();
console.log('📋 2. CLIENTE SUPABASE:', supabase ? 'CREADO' : 'ERROR');

// 3. Función de diagnóstico completo
async function diagnosticarProductos() {
    try {
        console.log('📋 3. PROBANDO CONEXIÓN A SUPABASE...');
        
        // Test 1: Contar productos totales
        const { count: totalCount, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.error('❌ Error contando productos:', countError);
            return;
        }
        
        console.log('📊 Total productos en DB:', totalCount);
        
        // Test 2: Cargar productos sin filtros
        const { data: allProducts, error: allError } = await supabase
            .from('products')
            .select('id, name, sku, is_active, stock_quantity, sale_price')
            .limit(100);
            
        if (allError) {
            console.error('❌ Error cargando productos:', allError);
            return;
        }
        
        console.log('📦 Productos cargados sin filtros:', allProducts?.length || 0);
        
        // Test 3: Cargar solo productos activos
        const { data: activeProducts, error: activeError } = await supabase
            .from('products')
            .select('id, name, sku, is_active, stock_quantity, sale_price')
            .eq('is_active', true)
            .limit(100);
            
        if (activeError) {
            console.error('❌ Error cargando productos activos:', activeError);
            return;
        }
        
        console.log('✅ Productos activos:', activeProducts?.length || 0);
        
        // Test 4: Análisis de estado
        if (allProducts) {
            const activos = allProducts.filter(p => p.is_active === true).length;
            const inactivos = allProducts.filter(p => p.is_active === false).length;
            const sinStock = allProducts.filter(p => p.stock_quantity === 0).length;
            const conStock = allProducts.filter(p => p.stock_quantity > 0).length;
            
            console.log('📊 ANÁLISIS DE PRODUCTOS:');
            console.log('  - Activos:', activos);
            console.log('  - Inactivos:', inactivos);
            console.log('  - Con stock:', conStock);
            console.log('  - Sin stock:', sinStock);
            
            // Mostrar algunos productos de ejemplo
            console.log('📋 PRODUCTOS DE EJEMPLO:');
            allProducts.slice(0, 5).forEach((p, i) => {
                console.log(`  ${i+1}. ${p.name} (${p.sku}) - Activo: ${p.is_active}, Stock: ${p.stock_quantity}`);
            });
        }
        
        // Test 5: Verificar usuario autenticado
        const { data: user, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('❌ Error obteniendo usuario:', userError);
        } else {
            console.log('👤 Usuario autenticado:', user?.user?.email || 'NO AUTENTICADO');
        }
        
        // Test 6: Probar consulta exacta del hook usePOSProducts
        console.log('📋 4. PROBANDO CONSULTA EXACTA DE usePOSProducts...');
        const { data: posProducts, error: posError } = await supabase
            .from('products')
            .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
            .order('name')
            .limit(5000);
            
        if (posError) {
            console.error('❌ Error en consulta POS:', posError);
        } else {
            console.log('✅ Productos POS cargados:', posProducts?.length || 0);
        }
        
        console.log('🎉 DIAGNÓSTICO COMPLETADO');
        
    } catch (error) {
        console.error('💥 ERROR GENERAL:', error);
    }
}

// Ejecutar diagnóstico
diagnosticarProductos();

// 4. Función para activar productos manualmente
window.activarTodosLosProductos = async function() {
    try {
        console.log('🔧 ACTIVANDO TODOS LOS PRODUCTOS...');
        
        const { data, error } = await supabase
            .from('products')
            .update({ is_active: true })
            .neq('is_active', true);
            
        if (error) {
            console.error('❌ Error activando productos:', error);
        } else {
            console.log('✅ Productos activados:', data?.length || 'Todos');
            console.log('🔄 Recarga la página para ver los cambios');
        }
    } catch (error) {
        console.error('💥 ERROR:', error);
    }
};

console.log('💡 FUNCIONES DISPONIBLES:');
console.log('  - diagnosticarProductos() - Ejecutar diagnóstico completo');
console.log('  - activarTodosLosProductos() - Activar todos los productos');