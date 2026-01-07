/**
 * CORRECCIÓN DE FILTROS POS - Ejecutar en consola del navegador
 * Copia y pega este código en la consola del navegador en la página del POS
 */

console.log('🔧 INICIANDO CORRECCIÓN DE FILTROS POS...');

// Función para resetear filtros problemáticos
function resetearFiltrosPOS() {
    console.log('🔄 Reseteando filtros POS...');
    
    // 1. Limpiar localStorage que pueda tener filtros guardados
    const keysToRemove = [
        'pos.prefs',
        'pos.filters',
        'pos.searchTerm',
        'pos.selectedCategory',
        'pos.showFeatured',
        'pos.stockFilter',
        'pos.priceRange'
    ];
    
    keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`✅ Eliminado: ${key}`);
        }
    });
    
    // 2. Resetear sessionStorage también
    keysToRemove.forEach(key => {
        if (sessionStorage.getItem(key)) {
            sessionStorage.removeItem(key);
            console.log(`✅ Eliminado de session: ${key}`);
        }
    });
    
    console.log('✅ Filtros reseteados. Recarga la página para aplicar cambios.');
}

// Función para verificar estado actual de filtros
function verificarFiltrosPOS() {
    console.log('🔍 VERIFICANDO ESTADO DE FILTROS...');
    
    // Buscar elementos de filtros en el DOM
    const searchInput = document.querySelector('input[placeholder*="Buscar"]') || 
                       document.querySelector('input[type="search"]');
    const categorySelect = document.querySelector('select') || 
                          document.querySelector('[role="combobox"]');
    const featuredToggle = document.querySelector('input[type="checkbox"]');
    
    console.log('📋 ESTADO ACTUAL:');
    
    if (searchInput) {
        console.log(`  - Búsqueda: "${searchInput.value || 'vacío'}"`);
        if (searchInput.value && searchInput.value.trim() !== '') {
            console.log('    ⚠️ HAY TÉRMINO DE BÚSQUEDA ACTIVO');
        }
    }
    
    // Verificar URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlFilters = {};
    
    for (const [key, value] of urlParams.entries()) {
        if (key.includes('filter') || key.includes('search') || key.includes('category')) {
            urlFilters[key] = value;
        }
    }
    
    if (Object.keys(urlFilters).length > 0) {
        console.log('  - Filtros en URL:', urlFilters);
        console.log('    ⚠️ HAY FILTROS EN LA URL');
    }
    
    // Verificar localStorage
    const localFilters = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('pos') || key.includes('filter'))) {
            localFilters[key] = localStorage.getItem(key);
        }
    }
    
    if (Object.keys(localFilters).length > 0) {
        console.log('  - Filtros en localStorage:', localFilters);
        console.log('    ⚠️ HAY FILTROS GUARDADOS LOCALMENTE');
    }
    
    // Buscar botones de filtro activos
    const activeFilterButtons = document.querySelectorAll('[aria-pressed="true"], .active, [data-state="on"]');
    if (activeFilterButtons.length > 0) {
        console.log(`  - Botones de filtro activos: ${activeFilterButtons.length}`);
        activeFilterButtons.forEach((btn, index) => {
            console.log(`    ${index + 1}. ${btn.textContent || btn.getAttribute('aria-label') || 'Sin texto'}`);
        });
        console.log('    ⚠️ HAY FILTROS VISUALES ACTIVOS');
    }
}

// Función para limpiar filtros visuales
function limpiarFiltrosVisuales() {
    console.log('🧹 LIMPIANDO FILTROS VISUALES...');
    
    // 1. Limpiar campo de búsqueda
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="Buscar"]');
    searchInputs.forEach((input, index) => {
        if (input.value) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`✅ Campo de búsqueda ${index + 1} limpiado`);
        }
    });
    
    // 2. Resetear selects a "all" o primera opción
    const selects = document.querySelectorAll('select');
    selects.forEach((select, index) => {
        const allOption = select.querySelector('option[value="all"]') || select.querySelector('option:first-child');
        if (allOption && select.value !== allOption.value) {
            select.value = allOption.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`✅ Select ${index + 1} reseteado a "${allOption.value}"`);
        }
    });
    
    // 3. Desactivar toggles/checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`✅ Checkbox ${index + 1} desactivado`);
    });
    
    // 4. Desactivar botones de filtro activos
    const activeButtons = document.querySelectorAll('[aria-pressed="true"], [data-state="on"]');
    activeButtons.forEach((button, index) => {
        button.click();
        console.log(`✅ Botón de filtro ${index + 1} desactivado`);
    });
    
    console.log('✅ Filtros visuales limpiados');
}

// Función para forzar recarga de productos
function forzarRecargaProductos() {
    console.log('🔄 FORZANDO RECARGA DE PRODUCTOS...');
    
    // Buscar botón de refresh/reload
    const refreshButtons = document.querySelectorAll('button[aria-label*="refresh"], button[aria-label*="reload"], button:contains("Actualizar")');
    
    if (refreshButtons.length > 0) {
        refreshButtons[0].click();
        console.log('✅ Botón de recarga clickeado');
    } else {
        // Forzar recarga de página
        console.log('🔄 Recargando página...');
        window.location.reload();
    }
}

// Función principal de corrección
function corregirFiltrosPOS() {
    console.log('🚀 INICIANDO CORRECCIÓN COMPLETA...');
    
    verificarFiltrosPOS();
    resetearFiltrosPOS();
    limpiarFiltrosVisuales();
    
    setTimeout(() => {
        console.log('🎉 CORRECCIÓN COMPLETADA');
        console.log('💡 Si los productos aún no aparecen, ejecuta: forzarRecargaProductos()');
    }, 1000);
}

// Ejecutar corrección automáticamente
corregirFiltrosPOS();

console.log('💡 FUNCIONES DISPONIBLES:');
console.log('  - corregirFiltrosPOS() - Corrección completa');
console.log('  - verificarFiltrosPOS() - Solo verificar estado');
console.log('  - resetearFiltrosPOS() - Solo resetear localStorage');
console.log('  - limpiarFiltrosVisuales() - Solo limpiar campos visuales');
console.log('  - forzarRecargaProductos() - Forzar recarga de productos');