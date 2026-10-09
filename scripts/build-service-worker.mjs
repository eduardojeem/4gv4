import { build } from 'esbuild'

// Built after Next for both Turbopack and webpack; registration/kill switch stay unchanged.
await build({
  entryPoints: ['src/lib/pwa/worker.ts'],
  outfile: 'public/sw.js',
  bundle: true,
  minify: true,
  sourcemap: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
})
console.log('Service worker built: static assets only; private requests use the network.')
