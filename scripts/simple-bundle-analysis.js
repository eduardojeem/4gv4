#!/usr/bin/env node

/**
 * Script simple para analizar el tamaño del bundle actual
 */

const fs = require('fs');
const path = require('path');

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = [];

  function walkDir(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        walkDir(itemPath);
      } else {
        totalSize += stats.size;
        files.push({
          name: path.relative('.next', itemPath),
          size: stats.size,
          path: itemPath
        });
      }
    }
  }

  walkDir(dirPath);
  return { totalSize, files };
}

function analyzeBundleSize() {
  console.log('🔍 Analizando tamaño del bundle actual...\n');

  const buildDir = '.next';
  if (!fs.existsSync(buildDir)) {
    console.log('❌ No se encontró el directorio .next. Ejecuta npm run build primero.');
    return;
  }

  // Analizar directorios principales
  const staticDir = path.join(buildDir, 'static');
  const serverDir = path.join(buildDir, 'server');
  
  let totalBundleSize = 0;
  const analysis = {
    static: { totalSize: 0, files: [] },
    server: { totalSize: 0, files: [] },
    other: { totalSize: 0, files: [] }
  };

  // Analizar static
  if (fs.existsSync(staticDir)) {
    const staticAnalysis = getDirectorySize(staticDir);
    analysis.static = staticAnalysis;
    totalBundleSize += staticAnalysis.totalSize;
  }

  // Analizar server
  if (fs.existsSync(serverDir)) {
    const serverAnalysis = getDirectorySize(serverDir);
    analysis.server = serverAnalysis;
    totalBundleSize += serverAnalysis.totalSize;
  }

  // Analizar otros archivos en .next
  const nextItems = fs.readdirSync(buildDir);
  for (const item of nextItems) {
    const itemPath = path.join(buildDir, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isFile()) {
      analysis.other.totalSize += stats.size;
      analysis.other.files.push({
        name: item,
        size: stats.size,
        path: itemPath
      });
      totalBundleSize += stats.size;
    }
  }

  // Mostrar resultados
  console.log('📊 RESUMEN DEL BUNDLE\n');
  console.log(`📦 Tamaño total: ${formatSize(totalBundleSize)}`);
  
  const targetSize = 8 * 1024 * 1024; // 8MB
  const percentage = (totalBundleSize / targetSize) * 100;
  const status = totalBundleSize <= targetSize ? '✅ CUMPLE' : '❌ EXCEDE';
  
  console.log(`🎯 Límite objetivo: ${formatSize(targetSize)}`);
  console.log(`📈 Porcentaje del límite: ${percentage.toFixed(1)}%`);
  console.log(`📋 Estado: ${status} el límite de 8MB\n`);

  // Desglose por categorías
  console.log('📂 DESGLOSE POR CATEGORÍAS:\n');
  console.log(`   Static (cliente): ${formatSize(analysis.static.totalSize)} (${((analysis.static.totalSize / totalBundleSize) * 100).toFixed(1)}%)`);
  console.log(`   Server: ${formatSize(analysis.server.totalSize)} (${((analysis.server.totalSize / totalBundleSize) * 100).toFixed(1)}%)`);
  console.log(`   Otros: ${formatSize(analysis.other.totalSize)} (${((analysis.other.totalSize / totalBundleSize) * 100).toFixed(1)}%)\n`);

  // Top 10 archivos más grandes
  const allFiles = [
    ...analysis.static.files.map(f => ({ ...f, category: 'static' })),
    ...analysis.server.files.map(f => ({ ...f, category: 'server' })),
    ...analysis.other.files.map(f => ({ ...f, category: 'other' }))
  ];

  const topFiles = allFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 15);

  console.log('🔝 TOP 15 ARCHIVOS MÁS GRANDES:\n');
  topFiles.forEach((file, index) => {
    const percentage = (file.size / totalBundleSize) * 100;
    console.log(`   ${index + 1}. ${file.name}`);
    console.log(`      Tamaño: ${formatSize(file.size)} (${percentage.toFixed(1)}%)`);
    console.log(`      Categoría: ${file.category}\n`);
  });

  // Recomendaciones
  console.log('💡 RECOMENDACIONES:\n');
  
  if (totalBundleSize > targetSize) {
    const excessMB = (totalBundleSize - targetSize) / 1024 / 1024;
    console.log(`   🔴 CRÍTICO: Bundle excede el límite por ${excessMB.toFixed(2)}MB`);
    console.log('   📋 Acciones requeridas:');
    console.log('      - Implementar code splitting más agresivo');
    console.log('      - Optimizar dependencias grandes');
    console.log('      - Usar lazy loading para componentes no críticos');
    console.log('      - Revisar y optimizar assets\n');
  }

  // Identificar archivos JavaScript grandes
  const largeJSFiles = topFiles.filter(f => f.name.endsWith('.js') && f.size > 500 * 1024);
  if (largeJSFiles.length > 0) {
    console.log('   ⚠️  Archivos JavaScript grandes detectados:');
    largeJSFiles.forEach(file => {
      console.log(`      - ${file.name}: ${formatSize(file.size)}`);
    });
    console.log('   💡 Considera dividir estos archivos usando dynamic imports\n');
  }

  // Identificar posibles duplicados
  const jsFiles = allFiles.filter(f => f.name.endsWith('.js'));
  const possibleVendorFiles = jsFiles.filter(f => 
    f.name.includes('vendor') || 
    f.name.includes('chunk') || 
    f.name.includes('framework')
  );
  
  if (possibleVendorFiles.length > 3) {
    console.log('   ℹ️  Múltiples archivos de vendor/framework detectados:');
    possibleVendorFiles.forEach(file => {
      console.log(`      - ${file.name}: ${formatSize(file.size)}`);
    });
    console.log('   💡 Revisa la configuración de splitChunks para optimizar\n');
  }

  return {
    totalSize: totalBundleSize,
    targetSize,
    compliant: totalBundleSize <= targetSize,
    percentage,
    analysis,
    topFiles
  };
}

// Ejecutar análisis
if (require.main === module) {
  const result = analyzeBundleSize();
  
  // Exit code basado en cumplimiento
  if (!result.compliant) {
    console.log('\n❌ El bundle NO cumple con el límite de 8MB');
    process.exit(1);
  } else {
    console.log('\n✅ El bundle cumple con el límite de 8MB');
    process.exit(0);
  }
}

module.exports = { analyzeBundleSize };