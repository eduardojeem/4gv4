#!/usr/bin/env node

/**
 * Script de Optimización Automática - Fase 4
 * Ejecuta todas las optimizaciones de rendimiento automáticamente
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OPTIMIZATION_TASKS = [
  {
    name: 'Análisis de Bundle',
    description: 'Analizar tamaño y estructura del bundle',
    command: 'node scripts/analyze-bundle-size.js',
    priority: 'high'
  },
  {
    name: 'Optimización de Imágenes',
    description: 'Comprimir y optimizar imágenes',
    command: 'npx next-optimized-images',
    priority: 'medium',
    optional: true
  },
  {
    name: 'Análisis de Dependencias',
    description: 'Identificar dependencias no utilizadas',
    command: 'npx depcheck',
    priority: 'medium'
  },
  {
    name: 'Verificación de TypeScript',
    description: 'Verificar tipos y errores',
    command: 'npx tsc --noEmit --skipLibCheck',
    priority: 'high'
  },
  {
    name: 'Lint y Formato',
    description: 'Verificar y corregir código',
    command: 'npm run lint',
    priority: 'medium'
  }
];

class ProjectOptimizer {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async optimize() {
    console.log('🚀 Iniciando optimización automática del proyecto...\n');

    // Ejecutar tareas de alta prioridad primero
    const highPriorityTasks = OPTIMIZATION_TASKS.filter(task => task.priority === 'high');
    const mediumPriorityTasks = OPTIMIZATION_TASKS.filter(task => task.priority === 'medium');

    await this.executeTasks(highPriorityTasks, 'Alta Prioridad');
    await this.executeTasks(mediumPriorityTasks, 'Media Prioridad');

    // Generar reporte final
    await this.generateOptimizationReport();
    
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log(`\n✅ Optimización completada en ${totalTime}s`);
  }

  async executeTasks(tasks, category) {
    console.log(`\n📋 Ejecutando tareas de ${category}:`);
    
    for (const task of tasks) {
      await this.executeTask(task);
    }
  }

  async executeTask(task) {
    const startTime = Date.now();
    console.log(`\n🔄 ${task.name}: ${task.description}`);

    try {
      const output = execSync(task.command, { 
        encoding: 'utf8',
        timeout: 120000, // 2 minutos timeout
        stdio: 'pipe'
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Completado en ${duration}s`);

      this.results.push({
        task: task.name,
        status: 'success',
        duration: parseFloat(duration),
        output: output.slice(0, 500) // Limitar output
      });

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (task.optional) {
        console.log(`⚠️  Opcional - Saltado (${duration}s): ${error.message.slice(0, 100)}`);
        this.results.push({
          task: task.name,
          status: 'skipped',
          duration: parseFloat(duration),
          error: error.message.slice(0, 200)
        });
      } else {
        console.log(`❌ Error (${duration}s): ${error.message.slice(0, 100)}`);
        this.results.push({
          task: task.name,
          status: 'error',
          duration: parseFloat(duration),
          error: error.message.slice(0, 200)
        });
      }
    }
  }

  async generateOptimizationReport() {
    console.log('\n📊 Generando reporte de optimización...');

    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: ((Date.now() - this.startTime) / 1000).toFixed(2),
      summary: {
        total: this.results.length,
        successful: this.results.filter(r => r.status === 'success').length,
        errors: this.results.filter(r => r.status === 'error').length,
        skipped: this.results.filter(r => r.status === 'skipped').length
      },
      tasks: this.results,
      recommendations: this.generateRecommendations(),
      nextSteps: this.generateNextSteps()
    };

    // Guardar reporte JSON
    const reportPath = './optimization-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generar reporte Markdown
    const markdownReport = this.generateMarkdownReport(report);
    fs.writeFileSync('./OPTIMIZATION_REPORT.md', markdownReport);

    console.log(`📄 Reporte guardado en: ${reportPath}`);
    console.log(`📄 Reporte Markdown: ./OPTIMIZATION_REPORT.md`);

    // Mostrar resumen en consola
    this.displaySummary(report);
  }

  generateRecommendations() {
    const recommendations = [];
    const errors = this.results.filter(r => r.status === 'error');

    if (errors.length > 0) {
      recommendations.push({
        type: 'error',
        priority: 'high',
        title: 'Resolver errores críticos',
        description: `${errors.length} tareas fallaron y requieren atención`,
        actions: errors.map(e => `Revisar: ${e.task}`)
      });
    }

    // Recomendaciones basadas en análisis de bundle
    if (fs.existsSync('./bundle-analysis/bundle-analysis.json')) {
      try {
        const bundleAnalysis = JSON.parse(fs.readFileSync('./bundle-analysis/bundle-analysis.json', 'utf8'));
        
        if (bundleAnalysis.recommendations) {
          bundleAnalysis.recommendations.forEach(rec => {
            recommendations.push({
              type: 'optimization',
              priority: rec.priority,
              title: rec.title,
              description: rec.description,
              actions: [rec.action]
            });
          });
        }
      } catch (e) {
        console.warn('No se pudo leer el análisis de bundle');
      }
    }

    // Recomendaciones generales
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Implementar monitoreo continuo',
      description: 'Configurar monitoreo de rendimiento en producción',
      actions: [
        'Configurar alertas de rendimiento',
        'Implementar métricas de usuario real',
        'Configurar dashboard de monitoreo'
      ]
    });

    return recommendations;
  }

  generateNextSteps() {
    return [
      {
        phase: 'Inmediato',
        tasks: [
          'Revisar y corregir errores encontrados',
          'Implementar lazy loading para componentes grandes',
          'Optimizar imágenes y assets'
        ]
      },
      {
        phase: 'Corto plazo (1-2 semanas)',
        tasks: [
          'Configurar monitoreo de rendimiento',
          'Implementar PWA básico',
          'Optimizar consultas de base de datos'
        ]
      },
      {
        phase: 'Mediano plazo (1 mes)',
        tasks: [
          'Implementar CDN para assets',
          'Configurar cache avanzado',
          'Optimizar SEO y accesibilidad'
        ]
      }
    ];
  }

  generateMarkdownReport(report) {
    return `# Reporte de Optimización - ${new Date().toLocaleDateString()}

## 📊 Resumen Ejecutivo

- **Duración total**: ${report.totalDuration}s
- **Tareas ejecutadas**: ${report.summary.total}
- **Exitosas**: ${report.summary.successful} ✅
- **Con errores**: ${report.summary.errors} ❌
- **Saltadas**: ${report.summary.skipped} ⚠️

## 🔍 Detalle de Tareas

${report.tasks.map(task => `
### ${task.task} ${task.status === 'success' ? '✅' : task.status === 'error' ? '❌' : '⚠️'}

- **Estado**: ${task.status}
- **Duración**: ${task.duration}s
${task.error ? `- **Error**: ${task.error}` : ''}
`).join('')}

## 🎯 Recomendaciones

${report.recommendations.map(rec => `
### ${rec.title} (${rec.priority})

${rec.description}

**Acciones recomendadas**:
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('')}

## 📈 Próximos Pasos

${report.nextSteps.map(step => `
### ${step.phase}

${step.tasks.map(task => `- ${task}`).join('\n')}
`).join('')}

## 📋 Checklist de Optimización

- [ ] Resolver errores críticos
- [ ] Implementar lazy loading
- [ ] Optimizar bundle splitting
- [ ] Configurar monitoreo
- [ ] Optimizar imágenes
- [ ] Implementar PWA
- [ ] Configurar CDN
- [ ] Optimizar SEO

---
*Reporte generado automáticamente el ${new Date().toLocaleString()}*
`;
  }

  displaySummary(report) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE OPTIMIZACIÓN');
    console.log('='.repeat(50));
    console.log(`⏱️  Tiempo total: ${report.totalDuration}s`);
    console.log(`✅ Exitosas: ${report.summary.successful}/${report.summary.total}`);
    console.log(`❌ Errores: ${report.summary.errors}`);
    console.log(`⚠️  Saltadas: ${report.summary.skipped}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n🎯 RECOMENDACIONES PRINCIPALES:');
      report.recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(`${i + 1}. ${rec.title} (${rec.priority})`);
      });
    }
    
    console.log('\n📄 Ver reporte completo en: ./OPTIMIZATION_REPORT.md');
    console.log('='.repeat(50));
  }
}

// Ejecutar optimización
const optimizer = new ProjectOptimizer();
optimizer.optimize().catch(console.error);