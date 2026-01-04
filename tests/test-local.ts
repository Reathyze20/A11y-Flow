#!/usr/bin/env ts-node
/**
 * test-local.ts
 * 
 * Lokální testovací skript pro A11y-Flow s automatickým generováním HTML reportů.
 * 
 * Použití:
 *   npm run test:local                            - skenuje default URL
 *   npm run test:local https://example.com        - skenuje zadanou URL
 *   npm run test:local https://example.com mobile - skenuje na mobilním viewportu
 * 
 * Generuje:
 *   - test-report.json     (JSON data)
 *   - test-report.html     (HTML vizualizace)
 */

import { WebScanner } from './src/core/WebScanner';
import { ScanOptions } from './src/core/WebScanner';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

// Výchozí URL pro testování
const DEFAULT_URL = 'https://www.wugi.cz/';

// Barvy pro terminálový output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  const startTime = Date.now();
  
  // Parse argumenty
  const targetUrl = process.argv[2] || DEFAULT_URL;
  const device = process.argv[3] as any || 'desktop';
  
  logSection('🚀 A11y-Flow Local Test Runner');
  
  log(`Target URL: ${targetUrl}`, 'cyan');
  log(`Device: ${device}`, 'cyan');
  log(`Output: test-report.json + test-report.html`, 'cyan');
  
  const scanner = new WebScanner();
  
  try {
    logSection('📊 Running Accessibility Scan');
    
    const options: ScanOptions = {
      device: device
    };
    
    const report = await scanner.scan(targetUrl, options);
    
    await scanner.closeBrowser();
    
    logSection('✅ Scan Complete');
    
    // Zobrazit základní statistiky
    const stats = report.stats;
    log(`Score: ${report.score}/100`, report.score >= 80 ? 'green' : report.score >= 60 ? 'yellow' : 'red');
    log(`Total Violations: ${stats.totalViolations}`, 'yellow');
    log(`  - Critical: ${stats.criticalCount}`, 'red');
    log(`  - Serious: ${report.violations.serious.length}`, 'yellow');
    log(`  - Moderate: ${report.violations.moderate.length}`, 'yellow');
    log(`  - Minor: ${report.violations.minor.length}`, 'blue');
    
    // Uložit JSON report
    const jsonPath = path.join(process.cwd(), 'test-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    log(`\n📄 JSON report saved: ${jsonPath}`, 'green');
    
    // Automaticky vygenerovat HTML report
    logSection('🎨 Generating HTML Report');
    
    await generateHtmlReport(jsonPath);
    
    const htmlPath = path.join(process.cwd(), 'test-report.html');
    log(`✅ HTML report saved: ${htmlPath}`, 'green');
    
    // Zobrazit top 3 problémy
    if (report.humanReadable?.topIssues && report.humanReadable.topIssues.length > 0) {
      logSection('🔴 Top 3 Issues');
      report.humanReadable.topIssues.slice(0, 3).forEach((issue, i) => {
        log(`${i + 1}. ${issue.priority} - ${issue.what}`, 'yellow');
        log(`   Fix: ${issue.fix}`, 'cyan');
      });
    }
    
    // Informace o nových funkcích
    logSection('✨ New Features in Report');
    if (report.annotatedScreenshot) {
      log('✓ Screenshot Annotation - Visual error map included', 'green');
    }
    if (report.domainHash) {
      log('✓ Badge Generation - Embed code available', 'green');
    }
    if (report.accessibilityStatement) {
      log('✓ Accessibility Statement - EU compliant template generated', 'green');
    }
    if (report.humanReadable?.actionItems.some(item => item.codeSnippet)) {
      log('✓ Fix-it Code Snippets - Before/after examples included', 'green');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logSection(`✅ Test Complete in ${duration}s`);
    
    log(`\nOpen HTML report: test-report.html`, 'bright');
    log(`View JSON data: test-report.json`, 'bright');
    
  } catch (error) {
    logSection('❌ Error');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Automaticky spustí generate-html-report.js pro vytvoření HTML
 */
async function generateHtmlReport(jsonPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `node generate-html-report.js "${jsonPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        log(`Warning: HTML generation had issues: ${error.message}`, 'yellow');
        // Necháme pokračovat i když HTML generování selže
        resolve();
        return;
      }
      
      if (stderr) {
        log(stderr, 'yellow');
      }
      
      if (stdout) {
        log(stdout, 'blue');
      }
      
      resolve();
    });
  });
}

// Spustit
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
