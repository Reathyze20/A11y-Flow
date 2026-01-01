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

// Helper pro rekurzivní přidávání souborů s Linuxovými právy
function addDirectoryToZip(zip, rootDir, relativePath = '') {
  const fullPath = path.join(rootDir, relativePath);
  const entries = fs.readdirSync(fullPath);

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry);
    const entryRelativePath = relativePath ? path.join(relativePath, entry).replace(/\\/g, '/') : entry;
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory()) {
      addDirectoryToZip(zip, rootDir, entryRelativePath);
    } else {
      const content = fs.readFileSync(entryPath);
      // DŮLEŽITÉ: Nastavíme UNIX permissions na 755 (rwxr-xr-x)
      // To zajistí, že Chromium binary bude spustitelné i po deployi z Windows
      // Atribut v ZIPu se skládá z práv posunutých o 16 bitů doleva
      zip.addFile(entryRelativePath, content, '', 0o755 << 16);
    }
  }
}

try {
 const rootDir = path.join(__dirname, '../../');
 const distDir = path.join(rootDir, 'dist');
 const zipPath = path.join(rootDir, CONFIG.ZIP_FILE_NAME);

  // 1. BUILD
  log("🚀 Starting Deployment...", colors.yellow);
  log("🔨 Building project...", colors.yellow);
  
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });

  // 2. PREPARE DEPENDENCIES (LINUX FORCE)
  log("📥 Installing production dependencies (Forcing Linux/x64)...", colors.yellow);
  
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  
  // Odstraníme AWS SDK
  if (pkg.dependencies && pkg.dependencies['@aws-sdk/client-s3']) {
      delete pkg.dependencies['@aws-sdk/client-s3'];
  }

  fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(pkg, null, 2));
  
  // Instalace s --no-bin-links může pomoci na Windows filesystémech
  execSync('npm install --omit=dev --os=linux --cpu=x64 --no-bin-links', { stdio: 'inherit', cwd: distDir });

  // 3. ZIP WITH PERMISSIONS
  log("📦 Zipping artifact with UNIX permissions...", colors.yellow);
  const zip = new AdmZip();
  
  // Použijeme vlastní funkci místo addLocalFolder
  addDirectoryToZip(zip, distDir);
  
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

  log("✅ Deployment successful!", colors.green);

} catch (error) {
  log("❌ Deployment failed!", colors.red);
  console.error(error.message);
  process.exit(1);
}