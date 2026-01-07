/**
 * DIAGNÓSTICO FINAL DEL SISTEMA POS
 * Ejecutar en consola del navegador para verificar que todo funciona
 */

console.log('🎯 DIAGNÓSTICO FINAL DEL SISTEMA POS...');

async function diagnosticoFinalPOS() {
    try {
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            'https://cswtugmwazxdktntndpy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        console.log('🔍 1. VERIFICANDO CONEXIÓN Y AUTENTICACIÓN...');
        
        // Verificar usuario
        const { data: user, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('❌ Error de autenticación:', userError.message);
            console.log('💡 Necesitas iniciar sesión para usar el POS');
            return;
        } else if (user?.user) {
            console.log('✅ Usuario autenticado:');
            console.log(`  - Email: ${user.user.email}`);
            console.log(`  - ID: ${user.user.id}`);
        } else {
            console.log('⚠️ Usuario no autenticado');
        }
        
        console.log('🔍 2. PROBANDO CONSULTA EXACTA DEL HOOK usePOSProducts...');
        
        // Esta es la consulta exacta que usa el hook
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
            .order('name')
            .limit(5000);
        
        if (productsError) {
            console.error('❌ ERROR EN CONSULTA DE PRODUCTOS:', productsError.message);
            console.log('💡 Este es el error que está viendo el POS');
            
            // Intentar consulta más simple
            console.log('🔍 Probando consulta más simple...');
            const { data: simpleProducts, error: simpleError } = await supabase
                .from('products')
                .select('id, name')
                .limit(5);
            
            if (simpleError) {
                console.error('❌ Error incluso en consulta simple:', simpleError.message);
                console.log('💡 La tabla products tiene problemas graves');
            } else {
                console.log('✅ Consulta simple funciona, problema en columnas específicas');
                console.log('📦 Productos encontrados:', simpleProducts?.length || 0);
            }
            
            return;
        }
        
        console.log('✅ CONSULTA DE PRODUCTOS EXITOSA');
        console.log(`📦 Total productos cargados: ${products?.length || 0}`);
        
        if (products && products.length > 0) {
            // Análisis detallado
            const activos = products.filter(p => p.is_active === true).length;
            const inactivos = products.filter(p => p.is_active === false).length;
            const conStock = products.filter(p => p.stock_quantity > 0).length;
            const sinStock = products.filter(p => p.stock_quantity === 0).length;
            const conPrecio = products.filter(p => p.sale_price > 0).length;
            const conBarcode = products.filter(p => p.barcode).length;
            
            console.log('📊 ANÁLISIS DETALLADO:');
            console.log(`  ✅ Productos activos: ${activos}`);
            console.log(`  ⚠️  Productos inactivos: ${inactivos}`);
            console.log(`  📦 Con stock: ${conStock}`);
            console.log(`  📭 Sin stock: ${sinStock}`);
            console.log(`  💰 Con precio: ${conPrecio}`);
            console.log(`  🏷️  Con código de barras: ${conBarcode}`);
            
            // Mostrar productos de ejemplo
            console.log('📋 PRIMEROS 5 PRODUCTOS:');
            products.slice(0, 5).forEach((p, i) => {
                console.log(`  ${i+1}. ${p.name}`);
                console.log(`     - SKU: ${p.sku}`);
                console.log(`     - Stock: ${p.stock_quantity}`);
                console.log(`     - Precio: ₲${p.sale_price?.toLocaleString()}`);
                console.log(`     - Activo: ${p.is_active}`);
                console.log(`     - Barcode: ${p.barcode || 'Sin código'}`);
            });
            
            // Verificar filtros que podrían ocultar productos
            console.log('🔍 3. VERIFICANDO FILTROS POTENCIALES...');
            
            // Simular filtros del POS
            const filtros = {
                busqueda: '',
                categoria: 'all',
                destacados: false,
                stock: 'all',
                precioMin: 0,
                precioMax: 10000000
            };
            
            let productosFiltrados = products;
            
            // Filtro de stock "in_stock" (el que estaba mal)
            const enStock = products.filter(p => p.stock_quantity > 0);
            const stockBajo = products.filter(p => p.stock_quantity <= 5 && p.stock_quantity > 0);
            
            console.log(`  📦 Filtro "En stock" (> 0): ${enStock.length} productos`);
            console.log(`  ⚠️  Filtro "Stock bajo" (1-5): ${stockBajo.length} productos`);
            
            if (enStock.length === 0) {
                console.log('❌ PROBLEMA: Ningún producto tiene stock > 0');
            }
            
            // Verificar precios
            const preciosValidos = products.filter(p => p.sale_price > 0);
            console.log(`  💰 Productos con precio válido: ${preciosValidos.length}`);
            
            if (preciosValidos.length === 0) {
                console.log('❌ PROBLEMA: Ningún producto tiene precio > 0');
            }
        } else {
            console.log('❌ NO SE ENCONTRARON PRODUCTOS');
            console.log('💡 Posibles causas:');
            console.log('  - Tabla products vacía');
            console.log('  - Todos los productos están inactivos');
            console.log('  - Políticas RLS muy restrictivas');
        }
        
        console.log('🔍 4. VERIFICANDO OTRAS TABLAS...');
        
        // Verificar categorías
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('id, name, is_active')
            .limit(10);
        
        if (catError) {
            console.log('⚠️ Tabla categories:', catError.message);
        } else {
            console.log(`✅ Categorías: ${categories?.length || 0}`);
        }
        
        // Verificar clientes
        const { data: customers, error: custError } = await supabase
            .from('customers')
            .select('id, name')
            .limit(5);
        
        if (custError) {
            console.log('⚠️ Tabla customers:', custError.message);
        } else {
            console.log(`✅ Clientes: ${customers?.length || 0}`);
        }
        
        console.log('🎉 DIAGNÓSTICO COMPLETADO');
        
        // Resumen final
        if (products && products.length > 0) {
            const activos = products.filter(p => p.is_active === true).length;
            
            if (activos >= 5) {
                console.log('🎉 ¡ÉXITO! El POS debería funcionar correctamente');
                console.log(`✅ ${activos} productos activos disponibles`);
                console.log('💡 Si aún no ves productos en el POS, verifica:');
                console.log('  1. Que no haya filtros activos (búsqueda, categoría, etc.)');
                console.log('  2. Que el componente Debug Panel muestre estos productos');
                console.log('  3. Que no haya errores en la consola del navegador');
            } else {
                console.log('⚠️ ADVERTENCIA: Pocos productos activos');
                console.log(`📦 Solo ${activos} productos activos de ${products.length} totales`);
                console.log('💡 Considera activar más productos');
            }
        } else {
            console.log('❌ PROBLEMA: No hay productos disponibles');
            console.log('💡 Ejecuta la migración: 20250106_simple_pos_setup.sql');
        }
        
    } catch (error) {
        console.error('💥 ERROR GENERAL:', error);
        console.log('💡 Verifica que Supabase esté configurado correctamente');
    }
}

// Función para activar productos si es necesario
window.activarProductosPOS = async function() {
    try {
        console.log('🔧 ACTIVANDO TODOS LOS PRODUCTOS...');
        
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            'https://cswtugmwazxdktntndpy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        const { data, error } = await supabase
            .from('products')
            .update({ is_active: true })
            .neq('is_active', true);
        
        if (error) {
            console.error('❌ Error activando productos:', error.message);
        } else {
            console.log('✅ Productos activados exitosamente');
            console.log('🔄 Ejecuta diagnosticoFinalPOS() para verificar');
        }
    } catch (error) {
        console.error('💥 ERROR:', error);
    }
};

// Ejecutar diagnóstico automáticamente
diagnosticoFinalPOS();

console.log('💡 FUNCIONES DISPONIBLES:');
console.log('  - diagnosticoFinalPOS() - Diagnóstico completo');
console.log('  - activarProductosPOS() - Activar todos los productos');