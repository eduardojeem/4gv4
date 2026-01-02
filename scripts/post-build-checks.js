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
  requiredChunks: [
    'dashboard',
    'pos', 
    'hooks',
    'performance'
  ],
  maxFileSize: 500 * 1024, // 500KB
  maxTotalSize: 8 * 1024 * 1024, // 8MB
  accessibilityChecks: true,
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
    
    // Verificar chunks requeridos
    await checkRequiredChunks(results);
    
    // Verificar configuración de accesibilidad
    if (CHECKS.accessibilityChecks) {
      await checkAccessibilityConfig(results);
    }
    
    // Verificar configuración de rendimiento
    if (CHECKS.performanceChecks) {
      await checkPerformanceConfig(results);
    }
    
    // Verificar integridad de componentes migrados
    await checkMigratedComponents(results);
    
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
 * Verifica que los chunks requeridos estén presentes
 */
async function checkRequiredChunks(results) {
  console.log('🧩 Verificando chunks requeridos...');
  
  const chunksDir = '.next/static/chunks';
  if (!fs.existsSync(chunksDir)) {
    results.checks.push({
      name: 'Verificación de chunks',
      status: 'failed',
      message: 'Directorio de chunks no encontrado'
    });
    results.failed++;
    return;
  }
  
  const chunkFiles = fs.readdirSync(chunksDir);
  const foundChunks = new Set();
  
  // Identificar chunks por nombre
  chunkFiles.forEach(file => {
    CHECKS.requiredChunks.forEach(requiredChunk => {
      if (file.includes(requiredChunk)) {
        foundChunks.add(requiredChunk);
      }
    });
  });
  
  // Verificar cada chunk requerido
  CHECKS.requiredChunks.forEach(requiredChunk => {
    const found = foundChunks.has(requiredChunk);
    
    results.checks.push({
      name: `Chunk requerido: ${requiredChunk}`,
      status: found ? 'passed' : 'warning',
      message: found ? 'Encontrado' : 'No encontrado - puede estar incluido en otro chunk'
    });
    
    if (found) {
      results.passed++;
    } else {
      results.warnings++;
    }
  });
}

/**
 * Verifica la configuración de accesibilidad
 */
async function checkAccessibilityConfig(results) {
  console.log('♿ Verificando configuración de accesibilidad...');
  
  // Verificar hooks de accesibilidad
  const accessibilityHooksPath = 'src/hooks/use-accessibility-improvements.ts';
  if (fs.existsSync(accessibilityHooksPath)) {
    results.checks.push({
      name: 'Hooks de accesibilidad',
      status: 'passed',
      message: 'Hooks de accesibilidad implementados'
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Hooks de accesibilidad',
      status: 'warning',
      message: 'Hooks de accesibilidad no encontrados'
    });
    results.warnings++;
  }
  
  // Verificar componentes de accesibilidad
  const accessibilityComponentsPath = 'src/components/dashboard/accessibility-configuration.tsx';
  if (fs.existsSync(accessibilityComponentsPath)) {
    results.checks.push({
      name: 'Componentes de accesibilidad',
      status: 'passed',
      message: 'Componentes de accesibilidad implementados'
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Componentes de accesibilidad',
      status: 'warning',
      message: 'Componentes de accesibilidad no encontrados'
    });
    results.warnings++;
  }
  
  // Verificar auditoría de accesibilidad
  const auditPath = 'ACCESSIBILITY_AUDIT.md';
  if (fs.existsSync(auditPath)) {
    results.checks.push({
      name: 'Auditoría de accesibilidad',
      status: 'passed',
      message: 'Auditoría de accesibilidad documentada'
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Auditoría de accesibilidad',
      status: 'warning',
      message: 'Auditoría de accesibilidad no documentada'
    });
    results.warnings++;
  }
}

/**
 * Verifica la configuración de rendimiento
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
  
  // Verificar configuración de Next.js
  const nextConfigPath = 'next.config.ts';
  if (fs.existsSync(nextConfigPath)) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    const hasOptimizations = [
      'splitChunks',
      'optimizePackageImports',
      'reactCompiler'
    ].every(optimization => configContent.includes(optimization));
    
    if (hasOptimizations) {
      results.checks.push({
        name: 'Configuración de Next.js optimizada',
        status: 'passed',
        message: 'Optimizaciones de rendimiento configuradas'
      });
      results.passed++;
    } else {
      results.checks.push({
        name: 'Configuración de Next.js optimizada',
        status: 'warning',
        message: 'Algunas optimizaciones pueden estar faltando'
      });
      results.warnings++;
    }
  }
}

/**
 * Verifica la integridad de componentes migrados
 */
async function checkMigratedComponents(results) {
  console.log('🔄 Verificando componentes migrados...');
  
  const migratedComponents = [
    'src/components/dashboard/products/core',
    'src/components/dashboard/products/filters',
    'src/components/dashboard/products/stats',
    'src/hooks/compound'
  ];
  
  let foundComponents = 0;
  
  migratedComponents.forEach(componentPath => {
    if (fs.existsSync(componentPath)) {
      foundComponents++;
    }
  });
  
  if (foundComponents === migratedComponents.length) {
    results.checks.push({
      name: 'Componentes migrados',
      status: 'passed',
      message: 'Todos los componentes migrados están presentes'
    });
    results.passed++;
  } else {
    results.checks.push({
      name: 'Componentes migrados',
      status: 'warning',
      message: `${foundComponents}/${migratedComponents.length} componentes migrados encontrados`
    });
    results.warnings++;
  }
  
  // Verificar hooks compuestos
  const hooksPath = 'src/hooks/compound';
  if (fs.existsSync(hooksPath)) {
    const hookFiles = fs.readdirSync(hooksPath);
    const requiredHooks = [
      'useProductManagement.ts',
      'useProductFiltering.ts', 
      'useProductAnalytics.ts'
    ];
    
    const foundHooks = requiredHooks.filter(hook => 
      hookFiles.includes(hook)
    );
    
    if (foundHooks.length === requiredHooks.length) {
      results.checks.push({
        name: 'Hooks compuestos',
        status: 'passed',
        message: 'Todos los hooks compuestos están implementados'
      });
      results.passed++;
    } else {
      results.checks.push({
        name: 'Hooks compuestos',
        status: 'warning',
        message: `${foundHooks.length}/${requiredHooks.length} hooks compuestos encontrados`
      });
      results.warnings++;
    }
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
if (import.meta.url === `file://${process.argv[1]}`) {
  runPostBuildChecks().catch(console.error);
}

export {
  runPostBuildChecks,
  CHECKS
};
