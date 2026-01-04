#!/usr/bin/env ts-node
/**
 * test-heading-structure.ts
 * 
 * Test specificky pro heading structure validaci
 */

import { WebScanner } from './src/core/WebScanner';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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
  const testFilePath = path.join(__dirname, 'test-pages', 'heading-structure-test.html');
  const testUrl = `file://${testFilePath}`;
  
  logSection('🧪 Heading Structure Test Suite');
  
  log(`Test File: ${testFilePath}`, 'cyan');
  log(`Test URL: ${testUrl}`, 'cyan');
  
  const scanner = new WebScanner();
  
  try {
    logSection('📊 Running Scan');
    
    const report = await scanner.scan(testUrl, { device: 'desktop' });
    await scanner.closeBrowser();
    
    logSection('✅ Scan Complete');
    
    const headingStructure = report.headingStructure;
    
    if (!headingStructure) {
      log('❌ CHYBA: Heading structure data nebyla vygenerována!', 'red');
      process.exit(1);
    }
    
    log(`\n📊 Statistiky:`, 'bright');
    log(`Total Headings: ${headingStructure.headings.length}`, 'cyan');
    
    const stats: any = {};
    headingStructure.headings.forEach(h => {
      stats[h.level] = (stats[h.level] || 0) + 1;
    });
    
    for (let i = 1; i <= 6; i++) {
      const count = stats[i] || 0;
      const color = count === 0 ? 'reset' : i === 1 && count > 1 ? 'red' : 'green';
      log(`  H${i}: ${count}`, color);
    }
    
    logSection('🔍 Detected Issues');
    
    if (headingStructure.issues.length === 0) {
      log('✓ No issues found!', 'green');
    } else {
      log(`Found ${headingStructure.issues.length} issues:\n`, 'yellow');
      
      headingStructure.issues.forEach((issue, index) => {
        const icon = issue.type === 'missing-h1' ? '❌' :
                     issue.type === 'multiple-h1' ? '🔴' :
                     issue.type === 'skipped-level' ? '⚠️' :
                     issue.type === 'empty-heading' ? '🚫' : '❓';
        
        log(`${index + 1}. ${icon} ${issue.type.toUpperCase()}`, 'yellow');
        log(`   ${issue.description}`, 'reset');
        log(`   WCAG: ${issue.wcagReference}`, 'cyan');
        
        if (issue.affectedHeadings && issue.affectedHeadings.length > 0) {
          log(`   Affected elements: ${issue.affectedHeadings.length}`, 'reset');
          issue.affectedHeadings.forEach(h => {
            log(`     - H${h.level}: "${h.text || '(empty)'}"`, 'reset');
          });
        }
        console.log('');
      });
    }
    
    logSection('🎯 Expected vs Actual');
    
    const expectations = [
      { name: 'Multiple H1', expected: true, actual: headingStructure.issues.some(i => i.type === 'multiple-h1') },
      { name: 'Skipped Level', expected: true, actual: headingStructure.issues.some(i => i.type === 'skipped-level') },
      { name: 'Empty Headings', expected: true, actual: headingStructure.issues.some(i => i.type === 'empty-heading') },
      { name: 'H1 Count = 4', expected: true, actual: stats[1] === 4 }
    ];
    
    let passed = 0;
    let failed = 0;
    
    expectations.forEach(test => {
      const status = test.expected === test.actual ? '✓' : '✗';
      const color = test.expected === test.actual ? 'green' : 'red';
      log(`${status} ${test.name}: ${test.actual ? 'DETECTED' : 'NOT DETECTED'}`, color);
      
      if (test.expected === test.actual) {
        passed++;
      } else {
        failed++;
      }
    });
    
    console.log('');
    log(`Tests: ${passed} passed, ${failed} failed`, failed === 0 ? 'green' : 'red');
    
    // Save report
    const outputPath = path.join(__dirname, 'test-heading-structure-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    log(`\n📄 JSON report saved: ${outputPath}`, 'cyan');
    
    // Generate HTML
    logSection('🎨 Generating HTML Report');
    
    exec(`node generate-html-report.js "${outputPath}"`, (error, stdout, stderr) => {
      if (error) {
        log(`Warning: HTML generation had issues: ${error.message}`, 'yellow');
      }
      if (stderr) {
        log(stderr, 'yellow');
      }
      if (stdout) {
        console.log(stdout);
      }
      
      const htmlPath = outputPath.replace('.json', '.html');
      log(`✅ HTML report saved: ${htmlPath}`, 'green');
      
      logSection(failed === 0 ? '✅ All Tests Passed!' : '❌ Some Tests Failed');
      
      log(`\nOpen reports:`, 'cyan');
      log(`  HTML: ${htmlPath}`, 'cyan');
      log(`  JSON: ${outputPath}`, 'cyan');
      
      process.exit(failed > 0 ? 1 : 0);
    });
    
  } catch (error: any) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
    await scanner.closeBrowser();
    process.exit(1);
  }
}

main();
