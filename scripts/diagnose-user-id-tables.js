/**
 * DIAGNÓSTICO DE TABLAS Y COLUMNAS user_id - Ejecutar en consola del navegador
 * Verifica qué tablas existen y qué columnas tienen
 */

console.log('🔍 DIAGNOSTICANDO TABLAS Y COLUMNAS user_id...');

async function diagnosticarTablasUserId() {
    try {
        // Importar Supabase
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            'https://cswtugmwazxdktntndpy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        console.log('📋 1. PROBANDO TABLA PRODUCTS...');
        
        // Probar tabla products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, sku, stock_quantity, is_active')
            .limit(3);
        
        if (productsError) {
            console.error('❌ Error con tabla products:', productsError.message);
        } else {
            console.log('✅ Tabla products funciona');
            console.log('📦 Productos encontrados:', products?.length || 0);
        }
        
        console.log('📋 2. PROBANDO TABLA PROFILES...');
        
        // Probar tabla profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, name, role')
            .limit(3);
        
        if (profilesError) {
            console.error('❌ Error con tabla profiles:', profilesError.message);
            console.log('💡 La tabla profiles no existe o no es accesible');
        } else {
            console.log('✅ Tabla profiles funciona');
            console.log('👤 Profiles encontrados:', profiles?.length || 0);
        }
        
        console.log('📋 3. PROBANDO TABLA SALES...');
        
        // Probar tabla sales
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('id, total, user_id, customer_id, created_at')
            .limit(3);
        
        if (salesError) {
            console.error('❌ Error con tabla sales:', salesError.message);
            console.log('💡 La tabla sales tiene problemas con user_id');
        } else {
            console.log('✅ Tabla sales funciona');
            console.log('💰 Sales encontradas:', sales?.length || 0);
        }
        
        console.log('📋 4. PROBANDO TABLA CUSTOMERS...');
        
        // Probar tabla customers
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id, name, email, phone')
            .limit(3);
        
        if (customersError) {
            console.error('❌ Error con tabla customers:', customersError.message);
            console.log('💡 La tabla customers no existe o no es accesible');
        } else {
            console.log('✅ Tabla customers funciona');
            console.log('👥 Customers encontrados:', customers?.length || 0);
        }
        
        console.log('📋 5. PROBANDO TABLA SALE_ITEMS...');
        
        // Probar tabla sale_items
        const { data: saleItems, error: saleItemsError } = await supabase
            .from('sale_items')
            .select('id, sale_id, product_id, quantity, unit_price')
            .limit(3);
        
        if (saleItemsError) {
            console.error('❌ Error con tabla sale_items:', saleItemsError.message);
            console.log('💡 La tabla sale_items no existe o no es accesible');
        } else {
            console.log('✅ Tabla sale_items funciona');
            console.log('🛒 Sale items encontrados:', saleItems?.length || 0);
        }
        
        console.log('📋 6. VERIFICANDO USUARIO ACTUAL...');
        
        // Verificar usuario actual
        const { data: user, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
            console.error('❌ Error obteniendo usuario:', userError.message);
        } else if (user?.user) {
            console.log('✅ Usuario autenticado:');
            console.log('  - ID:', user.user.id);
            console.log('  - Email:', user.user.email);
            console.log('  - Rol:', user.user.user_metadata?.user_role || 'user');
        } else {
            console.log('⚠️ Usuario no autenticado');
        }
        
        console.log('🎉 DIAGNÓSTICO COMPLETADO');
        
        // Resumen
        const tablesWorking = [
            !productsError && 'products',
            !profilesError && 'profiles', 
            !salesError && 'sales',
            !customersError && 'customers',
            !saleItemsError && 'sale_items'
        ].filter(Boolean);
        
        const tablesWithErrors = [
            productsError && 'products',
            profilesError && 'profiles',
            salesError && 'sales', 
            customersError && 'customers',
            saleItemsError && 'sale_items'
        ].filter(Boolean);
        
        console.log('📊 RESUMEN:');
        console.log(`✅ Tablas funcionando: ${tablesWorking.join(', ')}`);
        if (tablesWithErrors.length > 0) {
            console.log(`❌ Tablas con errores: ${tablesWithErrors.join(', ')}`);
            console.log('💡 Ejecuta la migración 20250106_fix_user_id_references.sql');
        } else {
            console.log('🎉 Todas las tablas funcionan correctamente');
        }
        
    } catch (error) {
        console.error('💥 ERROR GENERAL:', error);
    }
}

// Función para probar solo la consulta que está fallando
async function probarConsultaEspecifica() {
    try {
        console.log('🔍 PROBANDO CONSULTA ESPECÍFICA QUE FALLA...');
        
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
            'https://cswtugmwazxdktntndpy.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzd3R1Z213YXp4ZGt0bnRuZHB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTQ0MzgsImV4cCI6MjA3OTQ5MDQzOH0.JtXcBW3E1bEz59zfKNG2IWxzyVslpE_M1cWG6JeUT_g'
        );
        
        // Probar diferentes variaciones de la consulta
        const queries = [
            'SELECT id FROM sales LIMIT 1',
            'SELECT id, total FROM sales LIMIT 1', 
            'SELECT id, total, user_id FROM sales LIMIT 1',
            'SELECT * FROM sales LIMIT 1'
        ];
        
        for (const query of queries) {
            try {
                console.log(`🔍 Probando: ${query}`);
                const { data, error } = await supabase.rpc('exec_sql', { query });
                
                if (error) {
                    console.error(`❌ Error: ${error.message}`);
                } else {
                    console.log(`✅ Éxito: ${JSON.stringify(data).substring(0, 100)}...`);
                }
            } catch (err) {
                console.error(`💥 Error ejecutando: ${err.message}`);
            }
        }
        
    } catch (error) {
        console.error('💥 ERROR:', error);
    }
}

// Ejecutar diagnóstico automáticamente
diagnosticarTablasUserId();

console.log('💡 FUNCIONES DISPONIBLES:');
console.log('  - diagnosticarTablasUserId() - Diagnóstico completo');
console.log('  - probarConsultaEspecifica() - Probar consultas SQL específicas');