const esbuild = require('esbuild');
const path = require('path');

/**
 * Tento skript sbalí celou aplikaci do jednoho souboru 'dist/index.js'.
 * - Minimalizuje kód (minification) pro rychlejší start.
 * - Přibalí potřebné knihovny, ale vynechá ty, které jsou v AWS (aws-sdk).
 * - Zachází správně s binárními závislostmi.
 */

console.log('🚀 Starting build with esbuild...');

esbuild.build({
  // __dirname = <project-root>/src/scripts
  // Entry musí mířit na root "src/index.ts"
  entryPoints: [path.join(__dirname, '../index.ts')],
  bundle: true,
  minify: true,
  sourcemap: true, // Užitečné pro debugování v CloudWatch
  platform: 'node',
  target: 'node20', // Cílíme na Node.js 20 (AWS Lambda runtime)
  // Výstup do root "dist/index.js"
  outfile: path.join(__dirname, '../../dist/index.js'),
  
  // Externí moduly, které nechceme bundlovat (buď jsou v layeru, nebo je to AWS SDK)
  // '@sparticuz/chromium' často dělá problémy při bundlingu, někdy je lepší ho mít v externím layeru,
  // ale pro jednoduchost ho zkusíme zabalit. Pokud by to dělalo problémy, přidáme ho sem.
  external: ['@aws-sdk/client-s3'], 
}).then(() => {
  console.log('✅ Build successful: dist/index.js');
}).catch(() => {
  console.error('❌ Build failed');
  process.exit(1);
});