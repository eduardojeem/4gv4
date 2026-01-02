#!/usr/bin/env node

/**
 * Script para optimizar chunks compartidos y eliminar código duplicado
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Optimizando chunks compartidos...');

// Función para analizar imports duplicados
function analyzeImports(dir) {
  const imports = new Map();
  
  function scanFile(filePath) {
    if (!fs.existsSync(filePath) || !filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) {
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('@') || importPath.startsWith('react') || importPath.startsWith('next')) {
        if (!imports.has(importPath)) {
          imports.set(importPath, []);
        }
        imports.get(importPath).push(filePath);
      }
    }
  }
  
  function scanDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        scanFile(fullPath);
      }
    }
  }
  
  scanDirectory(dir);
  return imports;
}

// Analizar imports en src/
const srcImports = analyzeImports('./src');

console.log('📊 Análisis de imports compartidos:');
let sharedImports = 0;
for (const [importPath, files] of srcImports.entries()) {
  if (files.length > 3) { // Usado en más de 3 archivos
    console.log(`   ${importPath}: usado en ${files.length} archivos`);
    sharedImports++;
  }
}

console.log(`\n✅ Encontrados ${sharedImports} imports compartidos que se beneficiarán del chunking optimizado`);

// Crear archivo de configuración de chunks optimizados
const chunkConfig = {
  // Librerías más utilizadas
  mostUsed: Array.from(srcImports.entries())
    .filter(([, files]) => files.length > 5)
    .map(([importPath]) => importPath),
  
  // Librerías moderadamente utilizadas  
  moderatelyUsed: Array.from(srcImports.entries())
    .filter(([, files]) => files.length >= 3 && files.length <= 5)
    .map(([importPath]) => importPath),
    
  // Estadísticas
  stats: {
    totalImports: srcImports.size,
    sharedImports: sharedImports,
    analysisDate: new Date().toISOString()
  }
};

fs.writeFileSync('./chunk-analysis.json', JSON.stringify(chunkConfig, null, 2));
console.log('📝 Análisis guardado en chunk-analysis.json');

// Optimizar imports específicos de Recharts
console.log('\n🎯 Optimizando imports de Recharts...');

function optimizeRechartsImports(filePath) {
  if (!fs.existsSync(filePath)) return false;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Reemplazar imports completos de recharts con imports específicos
  const rechartsImportRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]recharts['"]/g;
  
  content = content.replace(rechartsImportRegex, (match, imports) => {
    const importList = imports.split(',').map(imp => imp.trim());
    const specificImports = importList.map(imp => {
      const cleanImp = imp.replace(/\s+as\s+\w+/, ''); // Remove aliases for mapping
      
      // Mapear componentes a sus imports específicos
      const componentMap = {
        'BarChart': 'recharts/es6/chart/BarChart',
        'LineChart': 'recharts/es6/chart/LineChart', 
        'PieChart': 'recharts/es6/chart/PieChart',
        'AreaChart': 'recharts/es6/chart/AreaChart',
        'XAxis': 'recharts/es6/cartesian/XAxis',
        'YAxis': 'recharts/es6/cartesian/YAxis',
        'CartesianGrid': 'recharts/es6/cartesian/CartesianGrid',
        'Tooltip': 'recharts/es6/component/Tooltip',
        'Legend': 'recharts/es6/component/Legend',
        'ResponsiveContainer': 'recharts/es6/component/ResponsiveContainer',
        'Bar': 'recharts/es6/cartesian/Bar',
        'Line': 'recharts/es6/cartesian/Line',
        'Area': 'recharts/es6/cartesian/Area',
        'Pie': 'recharts/es6/polar/Pie',
        'Cell': 'recharts/es6/component/Cell'
      };
      
      const specificPath = componentMap[cleanImp];
      if (specificPath) {
        return `import { ${imp} } from '${specificPath}';`;
      }
      return `import { ${imp} } from 'recharts';`;
    });
    
    modified = true;
    return specificImports.join('\n');
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

// Buscar y optimizar archivos con imports de Recharts
function optimizeRechartsInDirectory(dir) {
  let optimizedFiles = 0;
  
  function processFile(filePath) {
    if (optimizeRechartsImports(filePath)) {
      console.log(`   ✅ Optimizado: ${path.relative('.', filePath)}`);
      optimizedFiles++;
    }
  }
  
  function processDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        processDirectory(fullPath);
      } else if (stat.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('from \'recharts\'') || content.includes('from "recharts"')) {
          processFile(fullPath);
        }
      }
    }
  }
  
  processDirectory(dir);
  return optimizedFiles;
}

const optimizedCount = optimizeRechartsInDirectory('./src');
console.log(`✅ Optimizados ${optimizedCount} archivos con imports de Recharts`);

console.log('\n🎉 Optimización de chunks compartidos completada!');
console.log('💡 Los cambios se aplicarán en el próximo build');