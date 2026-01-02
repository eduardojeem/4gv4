#!/usr/bin/env node

/**
 * Script mejorado para análisis completo del bundle
 * Integra @next/bundle-analyzer con análisis personalizado
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración mejorada
const CONFIG = {
  outputDir: './bundle-analysis',
  targetSize: 8 * 1024 * 1024, // 8MB límite objetivo
  thresholds: {
    maxChunkSize: 500 * 1024, // 500KB por chunk
    maxTotalSize: 8 * 1024 * 1024, // 8MB total
    maxAssets: 100,
    compressionRatio: 0.7 // 70% máximo
  },
  reportFormats: ['json', 'html', 'markdown'],
  analysis: {
    trackHistory: true,
    generateRecommendations: true,
    identifyLargestContributors: true
  }
};

/**
 * Ejecuta análisis completo del bundle
 */
async function runCompleteAnalysis() {
  console.log('🔍 Iniciando análisis completo del bundle...\n');

  try {
    // Crear directorio de salida
    ensureOutputDirectory();

    // Paso 1: Ejecutar build con análisis
    console.log('📦 Ejecutando build con análisis...');
    await runBuildWithAnalysis();

    // Paso 2: Analizar archivos generados
    console.log('📊 Analizando composición del bundle...');
    const analysis = await performDetailedAnalysis();

    // Paso 3: Identificar mayores contribuyentes
    console.log('🔍 Identificando mayores contribuyentes...');
    const contributors = identifyLargestContributors(analysis);

    // Paso 4: Generar recomendaciones
    console.log('💡 Generando recomendaciones...');
    const recommendations = generateOptimizationRecommendations(analysis, contributors);

    // Paso 5: Crear reporte completo
    const completeReport = {
      ...analysis,
      largestContributors: contributors,
      recommendations: recommendations,
      complianceStatus: checkCompliance(analysis)
    };

    // Paso 6: Generar reportes
    await generateEnhancedReports(completeReport);

    // Paso 7: Mostrar resumen
    displayEnhancedSummary(completeReport);

    // Paso 8: Verificar cumplimiento
    const isCompliant = checkBundleSizeCompliance(completeReport);
    
    if (!isCompliant) {
      console.log('\n❌ El bundle NO cumple con el límite de 8MB');
      process.exit(1);
    } else {
      console.log('\n✅ El bundle cumple con el límite de 8MB');
    }

  } catch (error) {
    console.error('❌ Error durante el análisis:', error.message);
    process.exit(1);
  }
}

/**
 * Asegura que existe el directorio de salida
 */
function ensureOutputDirectory() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

/**
 * Ejecuta build con análisis habilitado
 */
async function runBuildWithAnalysis() {
  // Configurar variables de entorno
  process.env.ANALYZE = 'true';
  process.env.NODE_ENV = 'production';

  try {
    // Ejecutar build con webpack para análisis (Turbopack no es compatible con bundle analyzer)
    console.log('Ejecutando build con webpack para análisis...');
    execSync('npm run build -- --webpack', { 
      stdio: 'inherit',
      env: { ...process.env, ANALYZE: 'true' }
    });
  } catch (error) {
    throw new Error(`Build falló: ${error.message}`);
  }
}

/**
 * Realiza análisis detallado de archivos
 */
async function performDetailedAnalysis() {
  const buildDir = './.next';
  const staticDir = path.join(buildDir, 'static');
  
  if (!fs.existsSync(staticDir)) {
    throw new Error('Directorio de build no encontrado');
  }

  const analysis = {
    timestamp: new Date().toISOString(),
    buildInfo: getBuildInfo(buildDir),
    chunks: [],
    assets: [],
    totalSize: 0,
    gzippedSize: 0,
    sizeByCategory: {
      javascript: 0,
      css: 0,
      images: 0,
      fonts: 0,
      other: 0
    },
    routeAnalysis: {},
    dependencyBreakdown: {}
  };

  // Analizar chunks JavaScript
  await analyzeJavaScriptChunks(analysis, staticDir);
  
  // Analizar assets CSS
  await analyzeCSSAssets(analysis, staticDir);
  
  // Analizar otros assets
  await analyzeOtherAssets(analysis, staticDir);
  
  // Analizar por rutas
  analysis.routeAnalysis = analyzeByRoutes(analysis.chunks);
  
  // Analizar dependencias
  analysis.dependencyBreakdown = analyzeDependencies(analysis.chunks);

  return analysis;
}

/**
 * Obtiene información del build
 */
function getBuildInfo(buildDir) {
  const buildId = fs.readFileSync(path.join(buildDir, 'BUILD_ID'), 'utf8').trim();
  const manifestPath = path.join(buildDir, 'static', buildId, '_buildManifest.js');
  
  return {
    buildId,
    buildTime: new Date().toISOString(),
    nextVersion: getNextVersion(),
    hasManifest: fs.existsSync(manifestPath)
  };
}

/**
 * Obtiene la versión de Next.js
 */
function getNextVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.dependencies.next || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Analiza chunks JavaScript
 */
async function analyzeJavaScriptChunks(analysis, staticDir) {
  const jsDir = path.join(staticDir, 'chunks');
  if (!fs.existsSync(jsDir)) return;

  const jsFiles = fs.readdirSync(jsDir, { recursive: true })
    .filter(file => typeof file === 'string' && file.endsWith('.js'));

  for (const file of jsFiles) {
    const filePath = path.join(jsDir, file);
    if (!fs.existsSync(filePath)) continue;

    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const chunkInfo = {
      name: file,
      path: filePath,
      size: stats.size,
      gzippedSize: await estimateGzippedSize(content),
      type: determineChunkType(file, content),
      route: extractRouteFromChunk(file, content),
      dependencies: extractDependencies(content),
      lastModified: stats.mtime,
      isLarge: stats.size > CONFIG.thresholds.maxChunkSize
    };
    
    analysis.chunks.push(chunkInfo);
    analysis.totalSize += stats.size;
    analysis.gzippedSize += chunkInfo.gzippedSize;
    analysis.sizeByCategory.javascript += stats.size;
  }
}

/**
 * Analiza assets CSS
 */
async function analyzeCSSAssets(analysis, staticDir) {
  const cssDir = path.join(staticDir, 'css');
  if (!fs.existsSync(cssDir)) return;

  const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
  
  for (const file of cssFiles) {
    const filePath = path.join(cssDir, file);
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const assetInfo = {
      name: file,
      path: filePath,
      size: stats.size,
      gzippedSize: await estimateGzippedSize(content),
      type: 'css',
      lastModified: stats.mtime
    };
    
    analysis.assets.push(assetInfo);
    analysis.totalSize += stats.size;
    analysis.gzippedSize += assetInfo.gzippedSize;
    analysis.sizeByCategory.css += stats.size;
  }
}

/**
 * Analiza otros assets
 */
async function analyzeOtherAssets(analysis, staticDir) {
  const mediaDir = path.join(staticDir, 'media');
  if (!fs.existsSync(mediaDir)) return;

  const mediaFiles = fs.readdirSync(mediaDir, { recursive: true })
    .filter(file => typeof file === 'string');

  for (const file of mediaFiles) {
    const filePath = path.join(mediaDir, file);
    if (!fs.existsSync(filePath)) continue;

    const stats = fs.statSync(filePath);
    const ext = path.extname(file).toLowerCase();
    
    let category = 'other';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg'].includes(ext)) {
      category = 'images';
    } else if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
      category = 'fonts';
    }
    
    const assetInfo = {
      name: file,
      path: filePath,
      size: stats.size,
      type: category,
      extension: ext,
      lastModified: stats.mtime
    };
    
    analysis.assets.push(assetInfo);
    analysis.totalSize += stats.size;
    analysis.sizeByCategory[category] += stats.size;
  }
}

/**
 * Determina el tipo de chunk
 */
function determineChunkType(filename, content) {
  // Chunks de páginas específicas
  if (filename.includes('dashboard')) return 'dashboard';
  if (filename.includes('admin')) return 'admin';
  if (filename.includes('pos')) return 'pos';
  if (filename.includes('repairs')) return 'repairs';
  
  // Chunks de librerías
  if (filename.includes('vendor') || content.includes('node_modules')) return 'vendor';
  if (content.includes('@radix-ui')) return 'radix-ui';
  if (content.includes('@supabase')) return 'supabase';
  if (content.includes('recharts') || content.includes('chart')) return 'charts';
  
  // Chunks del framework
  if (filename.includes('framework') || content.includes('react')) return 'framework';
  if (filename.includes('main') || filename.includes('app')) return 'main';
  
  return 'other';
}

/**
 * Extrae la ruta del chunk
 */
function extractRouteFromChunk(filename, content) {
  // Intentar extraer ruta del nombre del archivo
  const routeMatch = filename.match(/pages?[\/\\](.+?)[\.-]/);
  if (routeMatch) return routeMatch[1];
  
  // Intentar extraer del contenido
  const contentRouteMatch = content.match(/["']\/([^"']+)["']/);
  if (contentRouteMatch) return contentRouteMatch[1];
  
  return 'unknown';
}

/**
 * Extrae dependencias del contenido
 */
function extractDependencies(content) {
  const dependencies = new Set();
  
  // Buscar imports de node_modules
  const nodeModulesMatches = content.match(/node_modules[\/\\]([^\/\\]+)/g) || [];
  nodeModulesMatches.forEach(match => {
    const dep = match.replace(/.*node_modules[\/\\]/, '').split(/[\/\\]/)[0];
    if (dep && !dep.startsWith('.')) {
      dependencies.add(dep);
    }
  });
  
  return Array.from(dependencies);
}

/**
 * Analiza chunks por rutas
 */
function analyzeByRoutes(chunks) {
  const routeAnalysis = {};
  
  chunks.forEach(chunk => {
    const route = chunk.route || 'unknown';
    if (!routeAnalysis[route]) {
      routeAnalysis[route] = {
        chunks: [],
        totalSize: 0,
        chunkCount: 0
      };
    }
    
    routeAnalysis[route].chunks.push(chunk.name);
    routeAnalysis[route].totalSize += chunk.size;
    routeAnalysis[route].chunkCount++;
  });
  
  return routeAnalysis;
}

/**
 * Analiza dependencias
 */
function analyzeDependencies(chunks) {
  const dependencyBreakdown = {};
  
  chunks.forEach(chunk => {
    chunk.dependencies.forEach(dep => {
      if (!dependencyBreakdown[dep]) {
        dependencyBreakdown[dep] = {
          chunks: [],
          totalSize: 0,
          usage: 0
        };
      }
      
      dependencyBreakdown[dep].chunks.push(chunk.name);
      dependencyBreakdown[dep].totalSize += chunk.size;
      dependencyBreakdown[dep].usage++;
    });
  });
  
  return dependencyBreakdown;
}

/**
 * Identifica los mayores contribuyentes al tamaño
 */
function identifyLargestContributors(analysis) {
  const contributors = [];
  
  // Top chunks por tamaño
  const largestChunks = analysis.chunks
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .map(chunk => ({
      type: 'chunk',
      name: chunk.name,
      size: chunk.size,
      percentage: (chunk.size / analysis.totalSize) * 100,
      category: chunk.type
    }));
  
  contributors.push(...largestChunks);
  
  // Top dependencias por tamaño
  const largestDependencies = Object.entries(analysis.dependencyBreakdown)
    .sort((a, b) => b[1].totalSize - a[1].totalSize)
    .slice(0, 10)
    .map(([dep, info]) => ({
      type: 'dependency',
      name: dep,
      size: info.totalSize,
      percentage: (info.totalSize / analysis.totalSize) * 100,
      usage: info.usage
    }));
  
  contributors.push(...largestDependencies);
  
  return contributors.sort((a, b) => b.size - a.size);
}

/**
 * Genera recomendaciones de optimización
 */
function generateOptimizationRecommendations(analysis, contributors) {
  const recommendations = [];
  
  // Verificar tamaño total
  if (analysis.totalSize > CONFIG.targetSize) {
    const excessMB = (analysis.totalSize - CONFIG.targetSize) / 1024 / 1024;
    recommendations.push({
      priority: 'high',
      type: 'bundle-size',
      title: 'Bundle excede el límite objetivo',
      description: `El bundle actual (${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB) excede el límite de 8MB por ${excessMB.toFixed(2)}MB`,
      impact: 'deployment-blocking',
      suggestions: [
        'Implementar code splitting más agresivo',
        'Optimizar dependencias grandes',
        'Usar lazy loading para componentes no críticos',
        'Revisar assets no optimizados'
      ]
    });
  }
  
  // Chunks muy grandes
  const largeChunks = analysis.chunks.filter(chunk => chunk.size > CONFIG.thresholds.maxChunkSize);
  if (largeChunks.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'code-splitting',
      title: `${largeChunks.length} chunks exceden el tamaño recomendado`,
      description: `Chunks grandes detectados: ${largeChunks.map(c => `${c.name} (${(c.size/1024).toFixed(1)}KB)`).join(', ')}`,
      impact: 'performance',
      suggestions: [
        'Dividir chunks grandes usando dynamic imports',
        'Mover código no crítico a chunks separados',
        'Implementar lazy loading por rutas'
      ]
    });
  }
  
  // Dependencias duplicadas o grandes
  const largeDependencies = Object.entries(analysis.dependencyBreakdown)
    .filter(([_, info]) => info.totalSize > 100 * 1024) // > 100KB
    .sort((a, b) => b[1].totalSize - a[1].totalSize)
    .slice(0, 5);
    
  if (largeDependencies.length > 0) {
    recommendations.push({
      priority: 'medium',
      type: 'dependency-optimization',
      title: 'Dependencias grandes detectadas',
      description: `Dependencias que contribuyen significativamente: ${largeDependencies.map(([dep, info]) => `${dep} (${(info.totalSize/1024).toFixed(1)}KB)`).join(', ')}`,
      impact: 'bundle-size',
      suggestions: [
        'Usar imports específicos en lugar de imports completos',
        'Considerar alternativas más ligeras',
        'Implementar tree shaking efectivo',
        'Revisar si todas las funcionalidades son necesarias'
      ]
    });
  }
  
  // Ratio de compresión bajo
  const compressionRatio = analysis.gzippedSize / analysis.totalSize;
  if (compressionRatio > CONFIG.thresholds.compressionRatio) {
    recommendations.push({
      priority: 'low',
      type: 'compression',
      title: 'Ratio de compresión subóptimo',
      description: `Ratio actual: ${(compressionRatio * 100).toFixed(1)}% (objetivo: <${(CONFIG.thresholds.compressionRatio * 100).toFixed(0)}%)`,
      impact: 'network-performance',
      suggestions: [
        'Revisar contenido no comprimible',
        'Optimizar assets binarios',
        'Configurar compresión adicional en el servidor'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Verifica cumplimiento del límite de tamaño
 */
function checkCompliance(analysis) {
  return {
    bundleSize: {
      current: analysis.totalSize,
      limit: CONFIG.targetSize,
      compliant: analysis.totalSize <= CONFIG.targetSize,
      percentage: (analysis.totalSize / CONFIG.targetSize) * 100
    },
    chunkSizes: {
      largeChunks: analysis.chunks.filter(c => c.size > CONFIG.thresholds.maxChunkSize).length,
      compliant: analysis.chunks.every(c => c.size <= CONFIG.thresholds.maxChunkSize)
    },
    compression: {
      ratio: analysis.gzippedSize / analysis.totalSize,
      compliant: (analysis.gzippedSize / analysis.totalSize) <= CONFIG.thresholds.compressionRatio
    }
  };
}

/**
 * Verifica si el bundle cumple con el límite de tamaño
 */
function checkBundleSizeCompliance(report) {
  return report.complianceStatus.bundleSize.compliant;
}

/**
 * Estima el tamaño comprimido
 */
async function estimateGzippedSize(content) {
  try {
    const zlib = require('zlib');
    return new Promise((resolve) => {
      zlib.gzip(content, (err, compressed) => {
        if (err) resolve(content.length * 0.3); // Estimación
        else resolve(compressed.length);
      });
    });
  } catch {
    return content.length * 0.3; // Estimación fallback
  }
}

/**
 * Genera reportes mejorados
 */
async function generateEnhancedReports(report) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Reporte JSON completo
  const jsonPath = path.join(CONFIG.outputDir, `bundle-analysis-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`📄 Reporte JSON: ${jsonPath}`);
  
  // Reporte Markdown mejorado
  const mdPath = path.join(CONFIG.outputDir, `bundle-analysis-${timestamp}.md`);
  const mdContent = generateEnhancedMarkdownReport(report);
  fs.writeFileSync(mdPath, mdContent);
  console.log(`📝 Reporte Markdown: ${mdPath}`);
  
  // Reporte de cumplimiento
  const compliancePath = path.join(CONFIG.outputDir, `compliance-report-${timestamp}.json`);
  fs.writeFileSync(compliancePath, JSON.stringify(report.complianceStatus, null, 2));
  console.log(`✅ Reporte de cumplimiento: ${compliancePath}`);
}

/**
 * Genera reporte Markdown mejorado
 */
function generateEnhancedMarkdownReport(report) {
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
  };

  let md = `# 📊 Análisis Completo del Bundle\n\n`;
  md += `**Fecha**: ${new Date(report.timestamp).toLocaleString('es-ES')}\n`;
  md += `**Build ID**: ${report.buildInfo.buildId}\n`;
  md += `**Next.js**: ${report.buildInfo.nextVersion}\n\n`;

  // Estado de cumplimiento
  const compliance = report.complianceStatus;
  const statusIcon = compliance.bundleSize.compliant ? '✅' : '❌';
  md += `## ${statusIcon} Estado de Cumplimiento\n\n`;
  md += `- **Tamaño del Bundle**: ${formatSize(compliance.bundleSize.current)} / ${formatSize(compliance.bundleSize.limit)} (${compliance.bundleSize.percentage.toFixed(1)}%)\n`;
  md += `- **Estado**: ${compliance.bundleSize.compliant ? 'CUMPLE' : 'NO CUMPLE'} con el límite de 8MB\n`;
  md += `- **Chunks Grandes**: ${compliance.chunkSizes.largeChunks} chunks exceden el límite\n`;
  md += `- **Compresión**: ${(compliance.compression.ratio * 100).toFixed(1)}% ratio\n\n`;

  // Resumen por categorías
  md += `## 📊 Resumen por Categorías\n\n`;
  md += `| Categoría | Tamaño | Porcentaje |\n`;
  md += `|-----------|--------|------------|\n`;
  Object.entries(report.sizeByCategory).forEach(([category, size]) => {
    if (size > 0) {
      const percentage = (size / report.totalSize) * 100;
      md += `| ${category} | ${formatSize(size)} | ${percentage.toFixed(1)}% |\n`;
    }
  });
  md += `\n`;

  // Mayores contribuyentes
  md += `## 🔝 Mayores Contribuyentes\n\n`;
  md += `| Tipo | Nombre | Tamaño | % del Total |\n`;
  md += `|------|--------|--------|-----------|\n`;
  report.largestContributors.slice(0, 15).forEach(contributor => {
    md += `| ${contributor.type} | ${contributor.name} | ${formatSize(contributor.size)} | ${contributor.percentage.toFixed(1)}% |\n`;
  });
  md += `\n`;

  // Recomendaciones
  if (report.recommendations.length > 0) {
    md += `## 💡 Recomendaciones de Optimización\n\n`;
    report.recommendations.forEach((rec, index) => {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      md += `### ${priorityIcon} ${rec.title}\n\n`;
      md += `**Prioridad**: ${rec.priority.toUpperCase()}\n`;
      md += `**Impacto**: ${rec.impact}\n`;
      md += `**Descripción**: ${rec.description}\n\n`;
      md += `**Sugerencias**:\n`;
      rec.suggestions.forEach(suggestion => md += `- ${suggestion}\n`);
      md += `\n`;
    });
  }

  return md;
}

/**
 * Muestra resumen mejorado en consola
 */
function displayEnhancedSummary(report) {
  console.log('\n📊 RESUMEN COMPLETO DEL ANÁLISIS\n');
  
  const compliance = report.complianceStatus;
  const statusIcon = compliance.bundleSize.compliant ? '✅' : '❌';
  
  console.log(`${statusIcon} ESTADO DE CUMPLIMIENTO:`);
  console.log(`   Tamaño actual: ${(report.totalSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Límite objetivo: ${(CONFIG.targetSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Porcentaje: ${compliance.bundleSize.percentage.toFixed(1)}%`);
  console.log(`   Estado: ${compliance.bundleSize.compliant ? 'CUMPLE' : 'NO CUMPLE'}`);
  
  console.log('\n📦 COMPOSICIÓN DEL BUNDLE:');
  Object.entries(report.sizeByCategory).forEach(([category, size]) => {
    if (size > 0) {
      const percentage = (size / report.totalSize) * 100;
      console.log(`   ${category}: ${(size / 1024 / 1024).toFixed(2)}MB (${percentage.toFixed(1)}%)`);
    }
  });
  
  console.log('\n🔝 TOP 5 CONTRIBUYENTES:');
  report.largestContributors.slice(0, 5).forEach((contributor, index) => {
    console.log(`   ${index + 1}. ${contributor.name}: ${(contributor.size / 1024).toFixed(1)}KB (${contributor.percentage.toFixed(1)}%)`);
  });
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMENDACIONES PRINCIPALES:');
    report.recommendations.slice(0, 3).forEach((rec, index) => {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`   ${priorityIcon} ${rec.title}`);
    });
  }
}

// Ejecutar análisis si se llama directamente
if (require.main === module) {
  runCompleteAnalysis().catch(console.error);
}

module.exports = { runCompleteAnalysis, CONFIG };