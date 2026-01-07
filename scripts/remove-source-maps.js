#!/usr/bin/env node

/**
 * Script para eliminar source maps después del build
 * Esto es necesario porque Turbopack genera source maps por defecto
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function removeSourceMaps(dir) {
  if (!fs.existsSync(dir)) return;
  
  let removedCount = 0;
  let totalSizeRemoved = 0;

  function walkDir(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        walkDir(itemPath);
      } else if (item.endsWith('.map')) {
        // Eliminar archivo .map
        const size = stats.size;
        fs.unlinkSync(itemPath);
        removedCount++;
        totalSizeRemoved += size;
        console.log(`🗑️  Eliminado: ${path.relative('.next', itemPath)} (${(size / 1024 / 1024).toFixed(2)}MB)`);
      }
    }
  }

  walkDir(dir);
  
  return { removedCount, totalSizeRemoved };
}

function main() {
  console.log('🧹 Eliminando source maps del build...\n');
  
  const buildDir = '.next';
  if (!fs.existsSync(buildDir)) {
    console.log('❌ No se encontró el directorio .next');
    process.exit(1);
  }

  const result = removeSourceMaps(buildDir);
  
  console.log('\n📊 RESUMEN:');
  console.log(`   Archivos eliminados: ${result.removedCount}`);
  console.log(`   Espacio liberado: ${(result.totalSizeRemoved / 1024 / 1024).toFixed(2)}MB`);
  
  if (result.removedCount > 0) {
    console.log('\n✅ Source maps eliminados exitosamente');
  } else {
    console.log('\n⚠️  No se encontraron source maps para eliminar');
  }
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { removeSourceMaps };