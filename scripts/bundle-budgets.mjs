/**
 * Presupuestos de tamaño del build, en gzip.
 *
 * Funciones puras separadas de post-build-checks.mjs para poder probarlas: ese
 * script arranca con un shebang y corre las verificaciones al importarse.
 */

import fs from 'fs';
import zlib from 'zlib';

/** Tamaño en gzip de un archivo, con cache: las rutas comparten chunks. */
const gzipCache = new Map();
export function gzipSizeOf(filePath) {
  if (gzipCache.has(filePath)) return gzipCache.get(filePath);
  const size = zlib.gzipSync(fs.readFileSync(filePath), { level: 9 }).length;
  gzipCache.set(filePath, size);
  return size;
}

/**
 * Archivos que pasan su presupuesto en gzip. Solo JS y CSS: las imagenes y
 * fuentes ya vienen comprimidas y no tienen presupuesto aca.
 */
export function findOversizedAssets(files, budgets, sizeOf = gzipSizeOf) {
  return files
    .map((file) => {
      const kind = file.endsWith('.css') ? 'css' : file.endsWith('.js') ? 'js' : null;
      if (!kind) return null;
      const gzip = sizeOf(file);
      return gzip > budgets[kind] ? { file, kind, gzip, budget: budgets[kind] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.gzip - a.gzip);
}

/**
 * Rutas cuya carga inicial de JS pasa el presupuesto, sumando en gzip los
 * chunks que declara Next en route-bundle-stats.json.
 */
export function findHeavyRoutes(routeStats, budget, sizeOf = gzipSizeOf, exists = fs.existsSync) {
  return routeStats
    .map((row) => {
      const chunks = (row.firstLoadChunkPaths || [])
        .map(normalizeChunkPath)
        .filter((chunk) => chunk.endsWith('.js') && exists(chunk));
      const gzip = chunks.reduce((sum, chunk) => sum + sizeOf(chunk), 0);
      return { route: row.route, gzip };
    })
    .filter((row) => row.gzip > budget)
    .sort((a, b) => b.gzip - a.gzip);
}

/** Ruta con barras normales, para comparar lo que da el disco con las diagnostics. */
export function normalizeChunkPath(filePath) {
  return filePath.split('\\').join('/');
}

/**
 * Chunks JS que alguna ruta carga de entrada.
 *
 * Un chunk que no aparece aca se baja bajo demanda —un import() al tocar un
 * boton—, asi que su tamaño no pesa en la primera carga de nadie. Sin separarlos,
 * diferir una libreria pesada seguia disparando la misma advertencia.
 */
export function firstLoadChunks(routeStats) {
  const chunks = new Set();
  for (const row of routeStats) {
    for (const chunk of row.firstLoadChunkPaths || []) chunks.add(normalizeChunkPath(chunk));
  }
  return chunks;
}
