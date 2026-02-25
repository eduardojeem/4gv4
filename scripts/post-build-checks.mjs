#!/usr/bin/env node

/**
 * Script de verificaciones post-build
 * Valida la integridad del build y la preparación para deployment
 */

import fs from 'fs';
import path from 'path';

// Configuración de verificaciones
const CHECKS = {
  requiredFiles: [
    '.next/BUILD_ID',
    '.next/static',
    '.next/server',
    'public'
  ],
  // Grupos de vendor que se generan por la config webpack en next.config.ts
  // Turbopack genera hashes, webpack nombra por cacheGroup — verificamos los webpack chunks
  webpackNamedChunks: [
    'framework',
    'vendor',
  ],
  maxFileSize: 600 * 1024, // 600KB (CSS bundleado puede superar 500KB por diseño)
  maxTotalSize: 15 * 1024 * 1024, // 15MB
  performanceChecks: true
};

/**
 * Ejecuta todas las verificaciones post-build
 */
async function runPostBuildChecks() {
  console.log('🔍 Iniciando verificaciones post-build...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: []
  };

  try {
    // Verificar estructura de archivos
    await checkFileStructure(results);
    
    // Verificar tamaños de archivos
    await checkFileSizes(results);
    
    // Verificar que el directorio de chunks exista y tenga contenido
    await checkChunksExist(results);
    
    // Verificar configuración de rendimiento
    if (CHECKS.performanceChecks) {
      await checkPerformanceConfig(results);
    }
    
    // Verificar integridad de componentes del producto
    await checkProductComponents(results);

    // Verificar hooks
    await checkHooks(results);
    
    // Mostrar resumen
    displayResults(results);
    
    // Determinar código de salida
    if (results.failed > 0) {
      console.log('\n❌ Algunas verificaciones fallaron. El build no está listo para deployment.');
      process.exit(1);
    } else if (results.warnings > 0) {
      console.log('\n⚠️  Build completado con advertencias. Revisar antes del deployment.');
      process.exit(0);
    } else {
      console.log('\n✅ Todas las verificaciones pasaron. Build listo para deployment.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error durante las verificaciones:', error.message);
    process.exit(1);
  }
}

/**
 * Verifica la estructura de archivos requerida
 */
async function checkFileStructure(results) {
  console.log('📁 Verificando estructura de archivos...');
  
  for (const requiredFile of CHECKS.requiredFiles) {
    const exists = fs.existsSync(requiredFile);
    
    results.checks.push({
      name: `Archivo/directorio requerido: ${requiredFile}`,
      status: exists ? 'passed' : 'failed',
      message: exists ? 'Encontrado' : 'No encontrado'
    });
    
    if (exists) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
}

/**
 * Verifica los tamaños de archivos
 */
async function checkFileSizes(results) {
  console.log('📏 Verificando tamaños de archivos...');
  
  const staticDir = '.next/static';
  if (!fs.existsSync(staticDir)) {
    results.checks.push({
      name: 'Verificación de tamaños',
      status: 'failed',
      message: 'Directorio static no encontrado'
    });
    results.failed++;
    return;
  }
  
  let totalSize = 0;
  const largeFiles = [];
  
  function checkDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        checkDirectory(itemPath);
      } else {
        totalSize += stats.size;
        
        if (stats.size > CHECKS.maxFileSize) {
          largeFiles.push({
            file: itemPath,
            size: stats.size
          });
        }
      }
    }
  }
  
  checkDirectory(staticDir);
  
  // Verificar archivos grandes
  if (largeFiles.length > 0) {
    results.checks.push({
      name: 'Archivos grandes detectados',
      status: 'warning',
      message: `${largeFiles.length} archivos exceden ${CHECKS.maxFileSize / 1024}KB`,
      details: largeFiles.map(f => `${f.file}: ${(f.size / 1024).toFixed(1)}KB`)
    });
    results.warnings++;
  } else {
    results.checks.push({
      name: 'Tamaños de archivos individuales',
      status: 'passed',
      message: 'Todos los archivos están dentro del límite'
    });
    results.passed++;
  }
  
  // Verificar tamaño total
  if (totalSize > CHECKS.maxTotalSize) {
    results.checks.push({
      name: 'Tamaño total del build',
      status: 'failed',
      message: `Tamaño total excede el límite: ${(totalSize / 1024 / 1024).toFixed(2)}MB > ${(CHECKS.maxTotalSize / 1024 / 1024).toFixed(1)}MB`
    });
    results.failed++;
  } else {
    results.checks.push({
      name: 'Tamaño total del build',
      status: 'passed',
      message: `Tamaño total: ${(totalSize / 1024 / 1024).toFixed(2)}MB`
    });
    results.passed++;
  }
}

/**
 * Verifica que el directorio de chunks tenga archivos JS generados.
 * Turbopack genera hashes aleatorios — no se verifican nombres específicos.
 */
async function checkChunksExist(results) {
  console.log('🧩 Verificando chunks generados...');
  
  const chunksDir = '.next/static/chunks';
  if (!fs.existsSync(chunksDir)) {
    results.checks.push({
      name: 'Directorio de chunks',
      status: 'failed',
      message: 'Directorio de chunks no encontrado'
    });
    results.failed++;
    return;
  }
  
  const allFiles = getAllFiles(chunksDir);
  const jsFiles = allFiles.filter(f => f.endsWith('.js'));
  const cssFiles = getAllFiles('.next/static').filter(f => f.endsWith('.css'));
  
  results.checks.push({
    name: 'Chunks JS generados',
    status: jsFiles.length > 0 ? 'passed' : 'failed',
    message: jsFiles.length > 0
      ? `${jsFiles.length} chunks JS generados`
      : 'No se encontraron chunks JS'
  });
  jsFiles.length > 0 ? results.passed++ : results.failed++;

  results.checks.push({
    name: 'Bundles CSS generados',
    status: cssFiles.length > 0 ? 'passed' : 'warning',
    message: cssFiles.length > 0
      ? `${cssFiles.length} bundle(s) CSS generados`
      : 'No se encontraron bundles CSS'
  });
  cssFiles.length > 0 ? results.passed++ : results.warnings++;
}

/**
 * Obtiene todos los archivos de un directorio recursivamente
 */
function getAllFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Verifica la configuración de rendimiento del proyecto
 */
async function checkPerformanceConfig(results) {
  console.log('⚡ Verificando configuración de rendimiento...');
  
  // Verificar utilidades de rendimiento
  const performancePath = 'src/lib/performance-optimization';
  if (fs.existsSync(performancePath)) {
    const performanceFiles = fs.readdirSync(performancePath);
    const requiredFiles = ['index.ts', 'hooks.ts', 'utils.ts'];
    
    const missingFiles = requiredFiles.filter(file => 
      !performanceFiles.includes(file)
    );
    
    if (missingFiles.length === 0) {
      results.checks.push({
        name: 'Utilidades de rendimiento',
        status: 'passed',
        message: 'Todas las utilidades de rendimiento están presentes'
      });
      results.passed++;
    } else {
      results.checks.push({
        name: 'Utilidades de rendimiento',
        status: 'warning',
        message: `Faltan archivos: ${missingFiles.join(', ')}`
      });
      results.warnings++;
    }
  } else {
    results.checks.push({
      name: 'Utilidades de rendimiento',
      status: 'failed',
      message: 'Directorio de utilidades de rendimiento no encontrado'
    });
    results.failed++;
  }
  
  // Verificar que next.config.ts tenga optimizaciones reales del proyecto
  const nextConfigPath = 'next.config.ts';
  if (fs.existsSync(nextConfigPath)) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    // Verificar optimizaciones que REALMENTE están en el config
    const checks = {
      optimizePackageImports: configContent.includes('optimizePackageImports'),
      productionSourceMaps: configContent.includes('productionBrowserSourceMaps: false'),
      compression: configContent.includes('compress: true'),
    };

    const allPresent = Object.values(checks).every(Boolean);
    const missing = Object.entries(checks)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (allPresent) {
      results.checks.push({
        name: 'Configuración de Next.js optimizada',
        status: 'passed',
        message: 'Optimizaciones clave configuradas (optimizePackageImports, source maps off, compresión)'
      });
      results.passed++;
    } else {
      results.checks.push({
        name: 'Configuración de Next.js optimizada',
        status: 'warning',
        message: `Optimizaciones faltantes: ${missing.join(', ')}`
      });
      results.warnings++;
    }
  }
}

/**
 * Verifica la integridad de los componentes de productos
 */
async function checkProductComponents(results) {
  console.log('🔄 Verificando componentes de productos...');
  
  const productComponentDirs = [
    'src/components/dashboard/products/core',
    'src/components/dashboard/products/filters',
    'src/components/dashboard/products/stats',
  ];
  
  let foundCount = 0;
  
  for (const componentPath of productComponentDirs) {
    if (fs.existsSync(componentPath)) {
      foundCount++;
    }
  }
  
  if (foundCount === productComponentDirs.length) {
    results.checks.push({
      name: 'Componentes de productos',
      status: 'passed',
      message: `Todos los directorios de componentes presentes (${foundCount}/${productComponentDirs.length})`
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Componentes de productos',
      status: 'warning',
      message: `${foundCount}/${productComponentDirs.length} directorios de componentes encontrados`
    });
    results.warnings++;
  }
}

/**
 * Verifica los hooks del proyecto
 */
async function checkHooks(results) {
  console.log('🪝 Verificando hooks del proyecto...');

  const requiredHooks = [
    'src/hooks/use-auth.ts',
    'src/hooks/use-products.ts',
    'src/components/ui/use-toast.tsx',
  ];

  let foundCount = 0;
  const missingHooks = [];

  for (const hookPath of requiredHooks) {
    if (fs.existsSync(hookPath)) {
      foundCount++;
    } else {
      missingHooks.push(hookPath);
    }
  }

  if (foundCount === requiredHooks.length) {
    results.checks.push({
      name: 'Hooks principales',
      status: 'passed',
      message: `Todos los hooks principales presentes (${foundCount}/${requiredHooks.length})`
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Hooks principales',
      status: 'warning',
      message: `${foundCount}/${requiredHooks.length} hooks encontrados`,
      details: missingHooks.map(h => `Faltante: ${h}`)
    });
    results.warnings++;
  }
}

/**
 * Muestra los resultados de las verificaciones
 */
function displayResults(results) {
  console.log('\n📊 RESULTADOS DE VERIFICACIONES\n');
  
  // Resumen
  console.log(`✅ Pasadas: ${results.passed}`);
  console.log(`⚠️  Advertencias: ${results.warnings}`);
  console.log(`❌ Fallidas: ${results.failed}`);
  console.log(`📋 Total: ${results.checks.length}\n`);
  
  // Detalles por categoría
  const categories = {
    passed: results.checks.filter(c => c.status === 'passed'),
    warning: results.checks.filter(c => c.status === 'warning'),
    failed: results.checks.filter(c => c.status === 'failed')
  };
  
  if (categories.failed.length > 0) {
    console.log('❌ VERIFICACIONES FALLIDAS:');
    categories.failed.forEach(check => {
      console.log(`   • ${check.name}: ${check.message}`);
      if (check.details) {
        check.details.forEach(detail => console.log(`     - ${detail}`));
      }
    });
    console.log('');
  }
  
  if (categories.warning.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    categories.warning.forEach(check => {
      console.log(`   • ${check.name}: ${check.message}`);
      if (check.details) {
        check.details.forEach(detail => console.log(`     - ${detail}`));
      }
    });
    console.log('');
  }
  
  if (categories.passed.length > 0) {
    console.log('✅ VERIFICACIONES EXITOSAS:');
    categories.passed.forEach(check => {
      console.log(`   • ${check.name}: ${check.message}`);
    });
  }
}

// Ejecutar verificaciones si se llama directamente
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  runPostBuildChecks().catch(console.error);
} else if (process.argv[1] && process.argv[1].endsWith('post-build-checks.mjs')) {
  // Fallback para ejecución directa
  runPostBuildChecks().catch(console.error);
}

export {
  runPostBuildChecks,
  CHECKS
};
