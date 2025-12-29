const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');

/**
 * CONFIGURATION
 * Uprav podle svého AWS nastavení!
 */
const CONFIG = {
  FUNCTION_NAME: "A11yFlow-Scanner",
  BUCKET_NAME: "a11yflow-deployment", // <--- ZKONTROLUJ SI, ŽE TOHLE SEDÍ S TVÝM S3
  REGION: "eu-central-1",
  ZIP_FILE_NAME: "deploy_package.zip"
};

// Barvičky pro konzoli
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

try {
  // __dirname = <project-root>/src/scripts
  // Skutečný root projektu je o dvě úrovně výš
  const rootDir = path.join(__dirname, '../../');
  const distDir = path.join(rootDir, 'dist');
  const zipPath = path.join(rootDir, CONFIG.ZIP_FILE_NAME);

  // 1. BUILD
  log("🚀 Starting Deployment...", colors.yellow);
  log("🔨 Building project...", colors.yellow);
  
  // Smažeme starý dist, ať máme čisto
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  
  // Spustí build
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // 2. PREPARE DEPENDENCIES
  log("📥 Installing production dependencies...", colors.yellow);
  
  // Zkopírujeme package.json do dist, abychom mohli nainstalovat jen produkční deps
  fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(distDir, 'package.json'));
  
  // Pokud existuje package-lock, vezmeme ho taky pro konzistenci
  if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) {
      fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
  }

  // Nainstalujeme POUZE dependencies (bez devDependencies jako typescript, esbuild atd.) přímo do dist
  // Tím zajistíme, že tam bude @sparticuz/chromium i s binárkou
  execSync('npm install --omit=dev', { stdio: 'inherit', cwd: distDir });

  // 3. ZIP
  log("📦 Zipping artifact (this may take a moment)...", colors.yellow);
  const zip = new AdmZip();
  
  // Zabalíme celý obsah složky dist (včetně nově vzniklého node_modules)
  zip.addLocalFolder(distDir);
  zip.writeZip(zipPath);
  log(`   Zip created at: ${zipPath}`, colors.green);

  // 4. UPLOAD TO S3
  log(`☁️  Uploading to S3 (${CONFIG.BUCKET_NAME})...`, colors.yellow);
  execSync(
    `aws s3 cp "${zipPath}" s3://${CONFIG.BUCKET_NAME}/${CONFIG.ZIP_FILE_NAME} --region ${CONFIG.REGION}`,
    { stdio: 'inherit' }
  );

  // 5. UPDATE LAMBDA
  log(`🔄 Updating Lambda Function (${CONFIG.FUNCTION_NAME})...`, colors.yellow);
  execSync(
    `aws lambda update-function-code --function-name ${CONFIG.FUNCTION_NAME} --s3-bucket ${CONFIG.BUCKET_NAME} --s3-key ${CONFIG.ZIP_FILE_NAME} --region ${CONFIG.REGION} --publish`,
    { stdio: 'inherit' }
  );

  // 6. CLEANUP
  log("🧹 Cleaning up...", colors.yellow);
  fs.unlinkSync(zipPath);
  // Volitelně můžeme promazat node_modules v dist, ale není to nutné, příští build to smaže

  log("✅ Deployment successful!", colors.green);

} catch (error) {
  log("❌ Deployment failed!", colors.red);
  console.error(error.message);
  process.exit(1);
}