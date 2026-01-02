#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔄 Reemplazando imports de framer-motion con wrapper optimizado...');

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

// Función para calcular la ruta relativa al wrapper
function getRelativePath(filePath) {
  const fileDir = path.dirname(filePath);
  const wrapperPath = 'src/components/ui/motion';
  
  // Calcular ruta relativa
  const relativePath = path.relative(fileDir, wrapperPath);
  return relativePath.startsWith('.') ? relativePath : './' + relativePath;
}

// Función para reemplazar imports en un archivo
function replaceImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Patrones de imports de framer-motion
    const patterns = [
      /import\s*{\s*([^}]+)\s*}\s*from\s*['"]framer-motion['"]/g,
      /import\s+\*\s+as\s+\w+\s+from\s*['"]framer-motion['"]/g,
      /import\s+\w+\s+from\s*['"]framer-motion['"]/g
    ];
    
    let hasFramerImport = false;
    let newContent = content;
    
    // Verificar si el archivo tiene imports de framer-motion
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        hasFramerImport = true;
      }
    });
    
    if (hasFramerImport) {
      const relativePath = getRelativePath(filePath);
      
      // Reemplazar todos los imports de framer-motion
      newContent = newContent.replace(
        /import\s*{\s*([^}]+)\s*}\s*from\s*['"]framer-motion['"]/g,
        `import { $1 } from '${relativePath}'`
      );
      
      newContent = newContent.replace(
        /import\s+\*\s+as\s+(\w+)\s+from\s*['"]framer-motion['"]/g,
        `import * as $1 from '${relativePath}'`
      );
      
      newContent = newContent.replace(
        /import\s+(\w+)\s+from\s*['"]framer-motion['"]/g,
        `import $1 from '${relativePath}'`
      );
      
      // Escribir el archivo actualizado
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Actualizado: ${filePath}`);
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
  let updatedCount = 0;
  
  console.log(`🔍 Encontrados ${files.length} archivos para revisar...`);
  
  files.forEach(file => {
    if (replaceImportsInFile(file)) {
      updatedCount++;
    }
  });
  
  console.log(`\n✅ Proceso completado:`);
  console.log(`   - ${updatedCount} archivos actualizados`);
  console.log(`   - ${files.length - updatedCount} archivos sin cambios`);
  
  if (updatedCount > 0) {
    console.log(`\n💡 Todos los imports de framer-motion han sido reemplazados con el wrapper optimizado`);
  }
}

// Verificar si glob está disponible
try {
  require.resolve('glob');
  main();
} catch (error) {
  console.log('📦 Instalando dependencia glob...');
  const { execSync } = require('child_process');
  execSync('npm install glob --save-dev', { stdio: 'inherit' });
  
  // Recargar y ejecutar
  delete require.cache[require.resolve('glob')];
  main();
}