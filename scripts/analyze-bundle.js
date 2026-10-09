#!/usr/bin/env node

/**
 * Script para analizar el bundle y generar reportes de rendimiento
 * Útil para monitorear el impacto de los componentes migrados
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL } from 'node:url';

// Configuración
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

    // Ejecutar build con análisis
    console.log('📦 Construyendo aplicación...');
    process.env.ANALYZE = 'true';
    execSync('npm run build', { stdio: 'inherit' });

    // Analizar archivos generados
    const buildDir = './.next';
    const staticDir = path.join(buildDir, 'static');
    
    if (!fs.existsSync(staticDir)) {
      throw new Error('Directorio de build no encontrado');
    }

    const analysis = await performAnalysis(staticDir);
    
    // Generar reportes
    await generateReports(analysis);
    
    // Mostrar resumen
    displaySummary(analysis);
    
    // Verificar umbrales
    checkThresholds(analysis);

  } catch (error) {
    console.error('❌ Error durante el análisis:', error.message);
    process.exit(1);
  }
}

/**
 * Realiza el análisis de archivos
 */
async function performAnalysis(staticDir) {
  const analysis = {
    timestamp: new Date().toISOString(),
    chunks: [],
    assets: [],
    totalSize: 0,
    gzippedSize: 0,
    componentBreakdown: {},
    recommendations: []
  };

  // Analizar chunks de JavaScript
  const jsDir = path.join(staticDir, 'chunks');
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(file => file.endsWith('.js'));
    
    for (const file of jsFiles) {
      const filePath = path.join(jsDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const chunkInfo = {
        name: file,
        size: stats.size,
        gzippedSize: await getGzippedSize(content),
        type: determineChunkType(file, content),
        components: extractComponentReferences(content),
        lastModified: stats.mtime
      };
      
      analysis.chunks.push(chunkInfo);
      analysis.totalSize += stats.size;
      analysis.gzippedSize += chunkInfo.gzippedSize;
    }
  }

  // Analizar assets CSS
  const cssDir = path.join(staticDir, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    
    for (const file of cssFiles) {
      const filePath = path.join(cssDir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const assetInfo = {
        name: file,
        size: stats.size,
        gzippedSize: await getGzippedSize(content),
        type: 'css',
        lastModified: stats.mtime
      };
      
      analysis.assets.push(assetInfo);
      analysis.totalSize += stats.size;
      analysis.gzippedSize += assetInfo.gzippedSize;
    }
  }

  // Generar breakdown por componentes
  analysis.componentBreakdown = generateComponentBreakdown(analysis.chunks);
  
  // Generar recomendaciones
  analysis.recommendations = generateRecommendations(analysis);

  return analysis;
}

/**
 * Determina el tipo de chunk basado en el nombre y contenido
 */
function determineChunkType(filename, content) {
  if (filename.includes('dashboard')) return 'dashboard';
  if (filename.includes('pos')) return 'pos';
  if (filename.includes('hooks')) return 'hooks';
  if (filename.includes('performance')) return 'performance';
  if (filename.includes('vendor') || filename.includes('node_modules')) return 'vendor';
  if (filename.includes('main') || filename.includes('app')) return 'main';
  if (content.includes('react') || content.includes('React')) return 'react';
  return 'other';
}

/**
 * Extrae referencias a componentes del código
 */
function extractComponentReferences(content) {
  const components = new Set();
  
  // Buscar imports de componentes
  const importMatches = content.match(/import.*from.*['"]@\/components\/([^'"]+)['"]/g) || [];
  importMatches.forEach(match => {
    const componentPath = match.match(/['"]@\/components\/([^'"]+)['"]/)?.[1];
    if (componentPath) {
      components.add(componentPath);
    }
  });

  // Buscar componentes de UI
  const uiMatches = content.match(/import.*from.*['"]@\/components\/ui\/([^'"]+)['"]/g) || [];
  uiMatches.forEach(match => {
    const componentName = match.match(/['"]@\/components\/ui\/([^'"]+)['"]/)?.[1];
    if (componentName) {
      components.add(`ui/${componentName}`);
    }
  });

  return Array.from(components);
}

/**
 * Genera breakdown por componentes
 */
function generateComponentBreakdown(chunks) {
  const breakdown = {};
  
  chunks.forEach(chunk => {
    chunk.components.forEach(component => {
      if (!breakdown[component]) {
        breakdown[component] = {
          totalSize: 0,
          chunks: [],
          usage: 0
        };
      }
      
      breakdown[component].totalSize += chunk.size;
      breakdown[component].chunks.push(chunk.name);
      breakdown[component].usage++;
    });
  });

  return breakdown;
}

/**
 * Genera recomendaciones basadas en el análisis
 */
function generateRecommendations(analysis) {
  const recommendations = [];
  
  // Chunks muy grandes
  const largeChunks = analysis.chunks.filter(chunk => chunk.size > CONFIG.thresholds.maxChunkSize);
  if (largeChunks.length > 0) {
    recommendations.push({
      type: 'warning',
      category: 'bundle-size',
      message: `${largeChunks.length} chunks exceden el tamaño recomendado (${CONFIG.thresholds.maxChunkSize / 1024}KB)`,
      details: largeChunks.map(chunk => `${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB`),
      suggestion: 'Considerar dividir estos chunks o usar lazy loading'
    });
  }

  // Componentes duplicados
  const duplicatedComponents = Object.entries(analysis.componentBreakdown)
    .filter(([_, info]) => info.usage > 3)
    .sort((a, b) => b[1].usage - a[1].usage);
    
  if (duplicatedComponents.length > 0) {
    recommendations.push({
      type: 'info',
      category: 'code-splitting',
      message: `${duplicatedComponents.length} componentes aparecen en múltiples chunks`,
      details: duplicatedComponents.slice(0, 5).map(([comp, info]) => 
        `${comp}: usado en ${info.usage} chunks`
      ),
      suggestion: 'Considerar extraer a chunks compartidos'
    });
  }

  // Tamaño total excesivo
  if (analysis.totalSize > CONFIG.thresholds.maxTotalSize) {
    recommendations.push({
      type: 'error',
      category: 'bundle-size',
      message: `Tamaño total del bundle excede el límite (${(CONFIG.thresholds.maxTotalSize / 1024 / 1024).toFixed(1)}MB)`,
      details: [`Tamaño actual: ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB`],
      suggestion: 'Implementar code splitting más agresivo y lazy loading'
    });
  }

  // Ratio de compresión bajo
  const compressionRatio = analysis.gzippedSize / analysis.totalSize;
  if (compressionRatio > 0.7) {
    recommendations.push({
      type: 'warning',
      category: 'compression',
      message: 'Ratio de compresión bajo detectado',
      details: [`Ratio actual: ${(compressionRatio * 100).toFixed(1)}%`],
      suggestion: 'Revisar contenido no comprimible (imágenes, fuentes, etc.)'
    });
  }

  return recommendations;
}

/**
 * Calcula el tamaño comprimido con gzip
 */
async function getGzippedSize(content) {
  const zlib = await import('zlib');
  return new Promise((resolve) => {
    zlib.gzip(content, (err, compressed) => {
      if (err) resolve(content.length * 0.3); // Estimación
      else resolve(compressed.length);
    });
  });
}

/**
 * Genera reportes en diferentes formatos
 */
async function generateReports(analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Reporte JSON
  if (CONFIG.reportFormats.includes('json')) {
    const jsonPath = path.join(CONFIG.outputDir, `bundle-analysis-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
    console.log(`📄 Reporte JSON generado: ${jsonPath}`);
  }

  // Reporte Markdown
  if (CONFIG.reportFormats.includes('markdown')) {
    const mdPath = path.join(CONFIG.outputDir, `bundle-analysis-${timestamp}.md`);
    const mdContent = generateMarkdownReport(analysis);
    fs.writeFileSync(mdPath, mdContent);
    console.log(`📝 Reporte Markdown generado: ${mdPath}`);
  }

  // Reporte HTML
  if (CONFIG.reportFormats.includes('html')) {
    const htmlPath = path.join(CONFIG.outputDir, `bundle-analysis-${timestamp}.html`);
    const htmlContent = generateHtmlReport(analysis);
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`🌐 Reporte HTML generado: ${htmlPath}`);
  }
}

/**
 * Genera reporte en formato Markdown
 */
function generateMarkdownReport(analysis) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  };

  let md = `# Análisis del Bundle\n\n`;
  md += `**Fecha**: ${new Date(analysis.timestamp).toLocaleString('es-ES')}\n\n`;

  // Resumen
  md += `## 📊 Resumen\n\n`;
  md += `- **Tamaño Total**: ${formatSize(analysis.totalSize)}\n`;
  md += `- **Tamaño Comprimido**: ${formatSize(analysis.gzippedSize)}\n`;
  md += `- **Ratio de Compresión**: ${((analysis.gzippedSize / analysis.totalSize) * 100).toFixed(1)}%\n`;
  md += `- **Total de Chunks**: ${analysis.chunks.length}\n`;
  md += `- **Total de Assets**: ${analysis.assets.length}\n\n`;

  // Chunks más grandes
  md += `## 📦 Chunks Principales\n\n`;
  const topChunks = analysis.chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 10);

  md += `| Chunk | Tamaño | Comprimido | Tipo |\n`;
  md += `|-------|--------|------------|------|\n`;
  topChunks.forEach(chunk => {
    md += `| ${chunk.name} | ${formatSize(chunk.size)} | ${formatSize(chunk.gzippedSize)} | ${chunk.type} |\n`;
  });
  md += `\n`;

  // Componentes más utilizados
  md += `## 🧩 Componentes Más Utilizados\n\n`;
  const topComponents = Object.entries(analysis.componentBreakdown)
    .sort((a, b) => b[1].usage - a[1].usage)
    .slice(0, 10);

  md += `| Componente | Uso | Tamaño Total |\n`;
  md += `|------------|-----|-------------|\n`;
  topComponents.forEach(([comp, info]) => {
    md += `| ${comp} | ${info.usage} chunks | ${formatSize(info.totalSize)} |\n`;
  });
  md += `\n`;

  // Recomendaciones
  if (analysis.recommendations.length > 0) {
    md += `## 💡 Recomendaciones\n\n`;
    analysis.recommendations.forEach((rec, index) => {
      const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
      md += `### ${icon} ${rec.message}\n\n`;
      md += `**Categoría**: ${rec.category}\n\n`;
      if (rec.details.length > 0) {
        md += `**Detalles**:\n`;
        rec.details.forEach(detail => md += `- ${detail}\n`);
        md += `\n`;
      }
      md += `**Sugerencia**: ${rec.suggestion}\n\n`;
    });
  }

  return md;
}

/**
 * Genera reporte en formato HTML
 */
function generateHtmlReport(analysis) {
  // Implementación básica de HTML
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Análisis del Bundle</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        .info { color: #1976d2; }
    </style>
</head>
<body>
    <h1>📊 Análisis del Bundle</h1>
    <div class="summary">
        <h2>Resumen</h2>
        <p><strong>Fecha:</strong> ${new Date(analysis.timestamp).toLocaleString('es-ES')}</p>
        <p><strong>Tamaño Total:</strong> ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB</p>
        <p><strong>Tamaño Comprimido:</strong> ${(analysis.gzippedSize / 1024 / 1024).toFixed(2)}MB</p>
        <p><strong>Total de Chunks:</strong> ${analysis.chunks.length}</p>
    </div>
    
    <h2>📦 Chunks Principales</h2>
    <table>
        <tr><th>Chunk</th><th>Tamaño</th><th>Tipo</th></tr>
        ${analysis.chunks
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .map(chunk => `
            <tr>
                <td>${chunk.name}</td>
                <td>${(chunk.size / 1024).toFixed(1)}KB</td>
                <td>${chunk.type}</td>
            </tr>
          `).join('')}
    </table>
    
    ${analysis.recommendations.length > 0 ? `
    <h2>💡 Recomendaciones</h2>
    ${analysis.recommendations.map(rec => `
        <div class="${rec.type}">
            <h3>${rec.message}</h3>
            <p><strong>Sugerencia:</strong> ${rec.suggestion}</p>
        </div>
    `).join('')}
    ` : ''}
</body>
</html>
  `;
}

/**
 * Muestra resumen en consola
 */
function displaySummary(analysis) {
  console.log('\n📊 RESUMEN DEL ANÁLISIS\n');
  console.log(`📦 Total de chunks: ${analysis.chunks.length}`);
  console.log(`📄 Total de assets: ${analysis.assets.length}`);
  console.log(`💾 Tamaño total: ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`🗜️  Tamaño comprimido: ${(analysis.gzippedSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`📉 Ratio de compresión: ${((analysis.gzippedSize / analysis.totalSize) * 100).toFixed(1)}%`);
  
  // Top 5 chunks más grandes
  const topChunks = analysis.chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
    
  console.log('\n🔝 TOP 5 CHUNKS MÁS GRANDES:');
  topChunks.forEach((chunk, index) => {
    console.log(`${index + 1}. ${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB (${chunk.type})`);
  });
}

/**
 * Verifica umbrales y muestra advertencias
 */
function checkThresholds(analysis) {
  console.log('\n🎯 VERIFICACIÓN DE UMBRALES\n');
  
  let hasIssues = false;
  
  // Verificar tamaño total
  if (analysis.totalSize > CONFIG.thresholds.maxTotalSize) {
    console.log(`❌ Tamaño total excede el límite: ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB > ${(CONFIG.thresholds.maxTotalSize / 1024 / 1024).toFixed(1)}MB`);
    hasIssues = true;
  } else {
    console.log(`✅ Tamaño total dentro del límite: ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB`);
  }
  
  // Verificar chunks grandes
  const largeChunks = analysis.chunks.filter(chunk => chunk.size > CONFIG.thresholds.maxChunkSize);
  if (largeChunks.length > 0) {
    console.log(`⚠️  ${largeChunks.length} chunks exceden ${CONFIG.thresholds.maxChunkSize / 1024}KB`);
    hasIssues = true;
  } else {
    console.log(`✅ Todos los chunks están dentro del límite de tamaño`);
  }
  
  // Verificar número de assets
  const totalAssets = analysis.chunks.length + analysis.assets.length;
  if (totalAssets > CONFIG.thresholds.maxAssets) {
    console.log(`⚠️  Número de assets excede el límite: ${totalAssets} > ${CONFIG.thresholds.maxAssets}`);
    hasIssues = true;
  } else {
    console.log(`✅ Número de assets dentro del límite: ${totalAssets}`);
  }
  
  if (!hasIssues) {
    console.log('\n🎉 ¡Todos los umbrales están dentro de los límites!');
  } else {
    console.log('\n⚠️  Se encontraron problemas. Revisa las recomendaciones.');
  }
}

// Ejecutar análisis si se llama directamente
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  analyzeBundleSize().catch(console.error);
}

export {
  analyzeBundleSize,
  CONFIG
};
