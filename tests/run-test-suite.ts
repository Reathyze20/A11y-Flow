
import { WebScanner } from './src/core/WebScanner';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { AuditReport } from './src/core/types';

const PORT = 8081;
const BASE_URL = `http://localhost:${PORT}`;
const RULES_DIR = path.join(__dirname, 'test-pages', 'rules');

// Map of filename to expected rule ID (partial match is enough)
const EXPECTED_VIOLATIONS: Record<string, string> = {
  'alt-text.html': 'image-alt',
  'autoplay.html': 'autoplay-media', // Matches a11yflow-autoplay-media
  'carousel.html': 'carousel-autoplay', // Matches a11yflow-carousel-autoplay
  'forms.html': 'label',
  'landmarks.html': 'landmark',
  'meta-viewport.html': 'meta-viewport',
  'modal.html': 'modal', // Custom rule
  'orientation.html': 'orientation', // Custom rule
  'skip-link.html': 'skip-link',
  'focus-order.html': 'focus', // Matches visual-focus-jump or modal-focus-bleed
};

const server = http.createServer((req, res) => {
  const filePath = path.join(RULES_DIR, req.url === '/' ? 'index.html' : req.url || '');
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function runTests() {
  console.log('Starting test server...');
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Server running at ${BASE_URL}`);

  const scanner = new WebScanner();
  const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html' && f !== 'focus-scenario.html'); // focus-scenario might be complex

  let passed = 0;
  let failed = 0;

  console.log(`\nFound ${files.length} test pages. Starting scans...\n`);

  for (const file of files) {
    const url = `${BASE_URL}/${file}`;
    console.log(`Testing ${file}...`);
    
    try {
      const report: AuditReport = await scanner.scan(url);
      const expectedRule = EXPECTED_VIOLATIONS[file];
      
      const allViolations = [
        ...report.violations.critical,
        ...report.violations.serious,
        ...report.violations.moderate,
        ...report.violations.minor
      ];

      if (!expectedRule) {
        console.warn(`⚠️  No expected rule defined for ${file}. Violations found: ${allViolations.length}`);
        continue;
      }

      const found = allViolations.some(v => v.id.includes(expectedRule) || v.description.toLowerCase().includes(expectedRule));
      
      if (found) {
        console.log(`✅ PASS: ${file} triggered rule "${expectedRule}"`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${file} did NOT trigger rule "${expectedRule}"`);
        console.log('   Found violations:', allViolations.map(v => v.id).join(', '));
        failed++;
      }

    } catch (error) {
      console.error(`❌ ERROR: Failed to scan ${file}`, error);
      failed++;
    }
    console.log('---');
  }

  console.log(`\nTest Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  server.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
