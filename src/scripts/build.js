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
  // DŮLEŽITÉ: '@sparticuz/chromium' a 'puppeteer-core' musí zůstat jako runtime
  // závislosti v `node_modules`, jinak `chromium.executablePath()` vrací `undefined`
  // a Lambda padá s chybou "The \"path\" argument must be of type string...".
  external: [
    '@aws-sdk/client-s3',
    '@sparticuz/chromium',
    'puppeteer-core',
    '@axe-core/puppeteer',
    'axe-core',
  ], 
}).then(() => {
  console.log('✅ Build successful: dist/index.js');
}).catch(() => {
  console.error('❌ Build failed');
  process.exit(1);
});