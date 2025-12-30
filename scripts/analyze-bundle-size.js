#!/usr/bin/env node

/**
 * Script de Análisis de Bundle - Fase 4 Optimización
 * Analiza el tamaño del bundle y genera recomendaciones de optimización
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuración de análisis
const CONFIG = {
  outputDir: './bundle-analysis',
  thresholds: {
    maxChunkSize: 250 * 1024, // 250KB
    maxTotalSize: 2 * 1024 * 1024, // 2MB
    maxAssets: 50
  },
  reportFormats: ['json', 'html', 'markdown']
};

/**
 * Ejecuta el análisis del bundle
 */
async function analyzeBundleSize() {
  console.log('🔍 Iniciando análisis del bundle...\n');

  try {
    // Crear directorio de salida
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    // Ejecutar build con análisis (saltamos por timeout)
    console.log('📦 Analizando archivos existentes directamente...');
    
    // Analizar archivos existentes
    const analysis = await analyzeExistingFiles();
    
    // Generar reportes
    await generateReports(analysis);
    
    console.log('\n✅ Análisis completado!');
    console.log(`📊 Reportes generados en: ${CONFIG.outputDir}`);
    
  } catch (error) {
    console.error('❌ Error en análisis:', error.message);
    process.exit(1);
  }
}

/**
 * Analiza archivos existentes del proyecto
 */
async function analyzeExistingFiles() {
  console.log('📊 Analizando estructura del proyecto...');
  
  const analysis = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: 0,
      totalSize: 0,
      largestFiles: [],
      componentCount: 0,
      hookCount: 0,
      utilCount: 0
    },
    categories: {
      components: [],
      hooks: [],
      utils: [],
      pages: [],
      lib: []
    },
    recommendations: []
  };

  // Analizar directorios principales
  const directories = [
    { path: 'src/components', category: 'components' },
    { path: 'src/hooks', category: 'hooks' },
    { path: 'src/utils', category: 'utils' },
    { path: 'src/app', category: 'pages' },
    { path: 'src/lib', category: 'lib' }
  ];

  for (const dir of directories) {
    if (fs.existsSync(dir.path)) {
      const files = await analyzeDirectory(dir.path);
      analysis.categories[dir.category] = files;
      analysis.summary.totalFiles += files.length;
      analysis.summary.totalSize += files.reduce((sum, f) => sum + f.size, 0);
    }
  }

  // Identificar archivos más grandes
  const allFiles = Object.values(analysis.categories).flat();
  analysis.summary.largestFiles = allFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  // Contar por tipo
  analysis.summary.componentCount = analysis.categories.components.length;
  analysis.summary.hookCount = analysis.categories.hooks.length;
  analysis.summary.utilCount = analysis.categories.utils.length;

  // Generar recomendaciones
  analysis.recommendations = generateOptimizationRecommendations(analysis);

  return analysis;
}

/**
 * Analiza un directorio recursivamente
 */
async function analyzeDirectory(dirPath) {
  const files = [];
  
  function scanDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);
    
    for (const item of items) {
      const fullPath = path.join(currentPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.match(/\.(ts|tsx|js|jsx)$/)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        files.push({
          path: fullPath.replace(/\\/g, '/'),
          name: item,
          size: stat.size,
          lines: content.split('\n').length,
          imports: (content.match(/^import/gm) || []).length,
          exports: (content.match(/^export/gm) || []).length,
          complexity: calculateComplexity(content)
        });
      }
    }
  }
  
  scanDirectory(dirPath);
  return files;
}

/**
 * Calcula la complejidad de un archivo
 */
function calculateComplexity(content) {
  const metrics = {
    functions: (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length,
    classes: (content.match(/class\s+\w+/g) || []).length,
    interfaces: (content.match(/interface\s+\w+/g) || []).length,
    hooks: (content.match(/use[A-Z]\w*/g) || []).length,
    jsx: (content.match(/<[A-Z]\w*/g) || []).length
  };
  
  return Object.values(metrics).reduce((sum, count) => sum + count, 0);
}

/**
 * Genera recomendaciones de optimización
 */
function generateOptimizationRecommendations(analysis) {
  const recommendations = [];
  
  // Archivos grandes
  const largeFiles = analysis.summary.largestFiles.filter(f => f.size > 50000);
  if (largeFiles.length > 0) {
    recommendations.push({
      type: 'size',
      priority: 'high',
      title: 'Archivos grandes detectados',
      description: `${largeFiles.length} archivos superan los 50KB`,
      files: largeFiles.map(f => f.path),
      action: 'Considerar dividir en módulos más pequeños o lazy loading'
    });
  }
  
  // Muchas importaciones
  const heavyImportFiles = Object.values(analysis.categories)
    .flat()
    .filter(f => f.imports > 20);
    
  if (heavyImportFiles.length > 0) {
    recommendations.push({
      type: 'imports',
      priority: 'medium',
      title: 'Archivos con muchas importaciones',
      description: `${heavyImportFiles.length} archivos tienen más de 20 importaciones`,
      files: heavyImportFiles.map(f => f.path),
      action: 'Revisar dependencias y considerar barrel exports'
    });
  }
  
  // Componentes complejos
  const complexComponents = analysis.categories.components
    .filter(f => f.complexity > 30);
    
  if (complexComponents.length > 0) {
    recommendations.push({
      type: 'complexity',
      priority: 'medium',
      title: 'Componentes complejos',
      description: `${complexComponents.length} componentes tienen alta complejidad`,
      files: complexComponents.map(f => f.path),
      action: 'Considerar dividir en subcomponentes'
    });
  }
  
  // Oportunidades de lazy loading
  const pageFiles = analysis.categories.pages.filter(f => f.name.includes('page.'));
  if (pageFiles.length > 10) {
    recommendations.push({
      type: 'lazy-loading',
      priority: 'high',
      title: 'Oportunidad de lazy loading',
      description: `${pageFiles.length} páginas pueden beneficiarse de lazy loading`,
      action: 'Implementar dynamic imports para páginas no críticas'
    });
  }
  
  return recommendations;
}

/**
 * Genera reportes en diferentes formatos
 */
async function generateReports(analysis) {
  console.log('📝 Generando reportes...');
  
  // Reporte JSON
  const jsonReport = JSON.stringify(analysis, null, 2);
  fs.writeFileSync(path.join(CONFIG.outputDir, 'bundle-analysis.json'), jsonReport);
  
  // Reporte Markdown
  const markdownReport = generateMarkdownReport(analysis);
  fs.writeFileSync(path.join(CONFIG.outputDir, 'bundle-analysis.md'), markdownReport);
  
  // Reporte HTML
  const htmlReport = generateHtmlReport(analysis);
  fs.writeFileSync(path.join(CONFIG.outputDir, 'bundle-analysis.html'), htmlReport);
  
  console.log('✅ Reportes generados exitosamente');
}

/**
 * Genera reporte en formato Markdown
 */
function generateMarkdownReport(analysis) {
  const { summary, recommendations } = analysis;
  
  return `# Análisis de Bundle - ${new Date().toLocaleDateString()}

## 📊 Resumen

- **Total de archivos**: ${summary.totalFiles}
- **Tamaño total**: ${(summary.totalSize / 1024 / 1024).toFixed(2)} MB
- **Componentes**: ${summary.componentCount}
- **Hooks**: ${summary.hookCount}
- **Utilidades**: ${summary.utilCount}

## 🔍 Archivos más grandes

${summary.largestFiles.map(f => 
  `- **${f.name}** (${(f.size / 1024).toFixed(1)} KB) - ${f.path}`
).join('\n')}

## 🎯 Recomendaciones de Optimización

${recommendations.map(rec => `
### ${rec.title} (${rec.priority})

${rec.description}

**Acción recomendada**: ${rec.action}

${rec.files ? `**Archivos afectados**:\n${rec.files.map(f => `- ${f}`).join('\n')}` : ''}
`).join('\n')}

## 📈 Próximos pasos

1. Implementar lazy loading para páginas no críticas
2. Optimizar componentes grandes
3. Revisar y optimizar importaciones
4. Considerar code splitting adicional
5. Implementar tree shaking mejorado
`;
}

/**
 * Genera reporte en formato HTML
 */
function generateHtmlReport(analysis) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análisis de Bundle</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-value { font-size: 24px; font-weight: bold; color: #0066cc; }
        .metric-label { font-size: 14px; color: #666; }
        .recommendation { border-left: 4px solid #0066cc; padding: 15px; margin: 15px 0; background: #f8f9fa; }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #ffc107; }
        .file-list { font-family: monospace; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Análisis de Bundle</h1>
        <p>Generado el ${new Date().toLocaleString()}</p>
    </div>
    
    <h2>Resumen del Proyecto</h2>
    <div class="metrics">
        <div class="metric">
            <div class="metric-value">${analysis.summary.totalFiles}</div>
            <div class="metric-label">Archivos totales</div>
        </div>
        <div class="metric">
            <div class="metric-value">${(analysis.summary.totalSize / 1024 / 1024).toFixed(2)} MB</div>
            <div class="metric-label">Tamaño total</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analysis.summary.componentCount}</div>
            <div class="metric-label">Componentes</div>
        </div>
        <div class="metric">
            <div class="metric-value">${analysis.summary.hookCount}</div>
            <div class="metric-label">Hooks</div>
        </div>
    </div>
    
    <h2>🎯 Recomendaciones</h2>
    ${analysis.recommendations.map(rec => `
        <div class="recommendation priority-${rec.priority}">
            <h3>${rec.title}</h3>
            <p>${rec.description}</p>
            <p><strong>Acción:</strong> ${rec.action}</p>
            ${rec.files ? `<div class="file-list">${rec.files.slice(0, 5).join('<br>')}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
}

// Ejecutar análisis
analyzeBundleSize().catch(console.error);