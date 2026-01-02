#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Corrigiendo rutas de imports con backslashes...');

// Función para encontrar todos los archivos TypeScript/JavaScript
function findFiles() {
  const patterns = [
    'src/**/*.tsx',
    'src/**/*.ts',
    'src/**/*.jsx',
    'src/**/*.js'
  ];
  
  let allFiles = [];
  patterns.forEach(pattern => {
    const files = glob.sync(pattern, { ignore: ['node_modules/**', '.next/**'] });
    allFiles = allFiles.concat(files);
  });
  
  return [...new Set(allFiles)]; // Remover duplicados
}

// Función para corregir imports en un archivo
function fixImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Buscar imports con backslashes
    const backslashImportPattern = /from\s*['"][^'"]*\\[^'"]*['"]/g;
    
    if (backslashImportPattern.test(content)) {
      // Reemplazar backslashes con forward slashes
      let newContent = content.replace(
        /from\s*['"]([^'"]*)['"]/g,
        (match, importPath) => {
          // Convertir backslashes a forward slashes
          const fixedPath = importPath.replace(/\\/g, '/');
          return `from '${fixedPath}'`;
        }
      );
      
      // Escribir el archivo actualizado
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Corregido: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return false;
  }
}

// Función principal
function main() {
  const files = findFiles();
  let fixedCount = 0;
  
  console.log(`🔍 Encontrados ${files.length} archivos para revisar...`);
  
  files.forEach(file => {
    if (fixImportsInFile(file)) {
      fixedCount++;
    }
  });
  
  console.log(`\n✅ Proceso completado:`);
  console.log(`   - ${fixedCount} archivos corregidos`);
  console.log(`   - ${files.length - fixedCount} archivos sin cambios`);
  
  if (fixedCount > 0) {
    console.log(`\n💡 Todas las rutas de imports han sido corregidas`);
  }
}

main();