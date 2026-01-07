/**
 * Script de prueba para verificar el debug panel del POS
 * Ejecutar en la consola del navegador en la página del POS
 */

console.log('🧪 INICIANDO PRUEBA DEL DEBUG PANEL POS...');

// 1. Verificar que el componente esté montado
const debugPanel = document.querySelector('[data-testid="pos-debug-panel"]') || 
                   document.querySelector('button:contains("Debug POS")') ||
                   document.querySelector('*[class*="debug"]');

if (debugPanel) {
    console.log('✅ Debug panel encontrado en el DOM');
} else {
    console.log('❌ Debug panel NO encontrado. Verificar:');
    console.log('  - Que esté en modo desarrollo (NODE_ENV=development)');
    console.log('  - Que el componente POSDebugPanel esté importado');
    console.log('  - Que no haya errores de compilación');
}

// 2. Verificar imports de Radix UI
try {
    const radixCollapsible = require('@radix-ui/react-collapsible');
    console.log('✅ @radix-ui/react-collapsible está disponible');
} catch (error) {
    console.log('❌ Error con @radix-ui/react-collapsible:', error.message);
    console.log('  - Ejecutar: npm install @radix-ui/react-collapsible');
}

// 3. Verificar hook usePOSProducts
try {
    // Esto solo funcionará si el hook está en el contexto global (no debería)
    console.log('ℹ️  Hook usePOSProducts debe estar funcionando dentro del componente POS');
} catch (error) {
    console.log('ℹ️  Hook usePOSProducts no accesible desde consola (normal)');
}

// 4. Verificar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
    console.log('✅ Variables de entorno de Supabase configuradas');
    console.log('  - URL:', supabaseUrl);
    console.log('  - Key:', supabaseKey.substring(0, 20) + '...');
} else {
    console.log('❌ Variables de entorno de Supabase NO configuradas');
}

// 5. Función para simular click en debug panel
window.testDebugPanel = function() {
    const debugButton = document.querySelector('button:contains("Debug POS")') ||
                       Array.from(document.querySelectorAll('button')).find(btn => 
                           btn.textContent.includes('Debug') || btn.textContent.includes('debug')
                       );
    
    if (debugButton) {
        console.log('🖱️  Simulando click en debug panel...');
        debugButton.click();
        setTimeout(() => {
            const debugContent = document.querySelector('[data-state="open"]') ||
                               document.querySelector('*[class*="collapsible"]');
            if (debugContent) {
                console.log('✅ Debug panel se abrió correctamente');
            } else {
                console.log('❌ Debug panel no se abrió');
            }
        }, 500);
    } else {
        console.log('❌ Botón de debug no encontrado');
    }
};

// 6. Verificar errores en consola
const originalError = console.error;
let errorCount = 0;

console.error = function(...args) {
    errorCount++;
    if (args[0] && typeof args[0] === 'string' && 
        (args[0].includes('POSDebugPanel') || args[0].includes('Collapsible'))) {
        console.log('🚨 Error relacionado con debug panel:', args[0]);
    }
    originalError.apply(console, args);
};

setTimeout(() => {
    console.log(`📊 RESUMEN DE PRUEBA:`);
    console.log(`  - Errores detectados: ${errorCount}`);
    console.log(`  - Debug panel: ${debugPanel ? 'Encontrado' : 'No encontrado'}`);
    console.log(`  - Supabase: ${supabaseUrl ? 'Configurado' : 'No configurado'}`);
    
    if (debugPanel && supabaseUrl && errorCount === 0) {
        console.log('🎉 ¡Todo parece estar funcionando correctamente!');
        console.log('💡 Ejecuta testDebugPanel() para probar la funcionalidad');
    } else {
        console.log('⚠️  Hay algunos problemas que resolver');
    }
}, 2000);

console.log('🔍 Prueba completada. Revisa los mensajes arriba.');
console.log('💡 Funciones disponibles:');
console.log('  - testDebugPanel() - Probar apertura del panel');