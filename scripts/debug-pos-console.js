/**
 * DIAGNÓSTICO RÁPIDO POS - Ejecutar en consola del navegador
 * Copia y pega este código en la consola del navegador en la página del POS
 */

console.log('🔍 INICIANDO DIAGNÓSTICO RÁPIDO POS...');

// Función principal de diagnóstico
async function diagnosticoRapidoPOS() {
    console.log('📋 1. VERIFICANDO CONFIGURACIÓN...');
    
    // 1. Variables de entorno
    const supabaseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:54321' // Supabase local
        : 'https://cswtugmwazxdktntndpy.supabase.co'; // Supabase remoto
    
    console.log('🔧 Variables de entorno:');
    console.log('  - SUPABASE_URL:', supabaseUrl);
    console.log('  - NODE_ENV:', 'development'); // Asumimos desarrollo
    
    // 2. Crear cliente Supabase manualmente
    console.log('📋 2. CREANDO CLIENTE SUPABASE...');
    
    try {
        // Importar Supabase (esto puede fallar si no está disponible globalmente)
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            supabaseUrl,
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        console.log('✅ Cliente Supabase creado');
        
        // 3. Test de conexión básico
        console.log('📋 3. PROBANDO CONEXIÓN...');
        
        const startTime = Date.now();
        const { data, error } = await supabase
            .from('products')
            .select('id')
            .limit(1);
        
        const connectionTime = Date.now() - startTime;
        
        if (error) {
            console.error('❌ Error de conexión:', error);
            return;
        }
        
        console.log(`✅ Conexión exitosa (${connectionTime}ms)`);
        
        // 4. Contar productos
        console.log('📋 4. CONTANDO PRODUCTOS...');
        
        const { count, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true });
        
        if (countError) {
            console.error('❌ Error contando productos:', countError);
        } else {
            console.log(`📊 Total productos en DB: ${count}`);
        }
        
        // 5. Cargar productos (query exacta del hook)
        console.log('📋 5. CARGANDO PRODUCTOS (QUERY EXACTA DEL HOOK)...');
        
        const queryStart = Date.now();
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, sku, barcode, sale_price, stock_quantity, category_id, description, is_active')
            .order('name')
            .limit(5000);
        
        const queryTime = Date.now() - queryStart;
        
        if (productsError) {
            console.error('❌ Error cargando productos:', productsError);
        } else {
            console.log(`📦 Productos cargados: ${products?.length || 0} (${queryTime}ms)`);
            
            if (products && products.length > 0) {
                // Análisis de productos
                const activos = products.filter(p => p.is_active === true).length;
                const inactivos = products.filter(p => p.is_active === false).length;
                const conStock = products.filter(p => p.stock_quantity > 0).length;
                
                console.log('📊 ANÁLISIS DE PRODUCTOS:');
                console.log(`  - Activos: ${activos}`);
                console.log(`  - Inactivos: ${inactivos}`);
                console.log(`  - Con stock: ${conStock}`);
                
                // Mostrar primeros 3 productos
                console.log('📋 PRIMEROS 3 PRODUCTOS:');
                products.slice(0, 3).forEach((p, i) => {
                    console.log(`  ${i+1}. ${p.name} (${p.sku})`);
                    console.log(`     - Activo: ${p.is_active}`);
                    console.log(`     - Stock: ${p.stock_quantity}`);
                    console.log(`     - Precio: ${p.sale_price}`);
                });
            }
        }
        
        // 6. Verificar usuario
        console.log('📋 6. VERIFICANDO USUARIO...');
        
        const { data: user, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('❌ Error obteniendo usuario:', userError);
        } else if (user?.user) {
            console.log('👤 Usuario autenticado:');
            console.log(`  - Email: ${user.user.email}`);
            console.log(`  - Rol: ${user.user.user_metadata?.user_role || 'user'}`);
        } else {
            console.log('⚠️ Usuario no autenticado');
        }
        
        // 7. Resumen final
        console.log('🎉 RESUMEN DEL DIAGNÓSTICO:');
        console.log(`  - Conexión: ✅ (${connectionTime}ms)`);
        console.log(`  - Total en DB: ${count || 'Error'}`);
        console.log(`  - Cargados: ${products?.length || 0}`);
        console.log(`  - Usuario: ${user?.user ? '✅' : '❌'}`);
        
        if (products && products.length > 0) {
            console.log('🎉 ¡PRODUCTOS ENCONTRADOS! El problema podría estar en el hook usePOSProducts');
        } else if (count && count > 0) {
            console.log('⚠️ HAY PRODUCTOS EN DB PERO NO SE CARGAN - Problema de RLS o query');
        } else {
            console.log('❌ NO HAY PRODUCTOS EN LA BASE DE DATOS');
        }
        
    } catch (importError) {
        console.error('❌ Error importando Supabase:', importError);
        console.log('💡 Intentando método alternativo...');
        
        // Método alternativo usando fetch
        await diagnosticoConFetch();
    }
}

// Método alternativo usando fetch directo
async function diagnosticoConFetch() {
    console.log('📋 DIAGNÓSTICO CON FETCH...');
    
    try {
        const response = await fetch('/api/products?limit=10');
        const data = await response.json();
        
        console.log('📡 Respuesta de API:', data);
        
        if (data.success && data.data?.products) {
            console.log(`📦 Productos desde API: ${data.data.products.length}`);
        } else {
            console.log('⚠️ API no devuelve productos o hay error');
        }
    } catch (fetchError) {
        console.error('❌ Error con fetch:', fetchError);
    }
}

// Función para activar productos
window.activarProductosConsola = async function() {
    console.log('🔧 ACTIVANDO PRODUCTOS...');
    
    try {
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
            console.error('❌ Error activando productos:', error);
        } else {
            console.log('✅ Productos activados');
            console.log('🔄 Ejecuta diagnosticoRapidoPOS() de nuevo para verificar');
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
};

// Ejecutar diagnóstico automáticamente
diagnosticoRapidoPOS();

console.log('💡 FUNCIONES DISPONIBLES:');
console.log('  - diagnosticoRapidoPOS() - Ejecutar diagnóstico completo');
console.log('  - activarProductosConsola() - Activar todos los productos');
console.log('  - diagnosticoConFetch() - Probar API endpoint');