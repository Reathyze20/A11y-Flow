import { WebScanner } from './src/core/WebScanner';
import * as fs from 'fs';
import * as path from 'path';

const testFile = path.join(__dirname, 'test-pages', 'heading-all-detections.html');
const testUrl = `file://${testFile.replace(/\\/g, '/')}`;

console.log('\n============================================================');
console.log('🧪 Comprehensive Heading Structure Test Suite');
console.log('============================================================\n');
console.log(`Test File: ${testFile}`);
console.log(`Test URL: ${testUrl}\n`);

console.log('============================================================');
console.log('📊 Running Scan');
console.log('============================================================\n');

const scanner = new WebScanner();

scanner.scan(testUrl).then(result => {
  console.log('\n============================================================');
  console.log('✅ Scan Complete');
  console.log('============================================================\n');

  const headingStructure = result.headingStructure;
  if (!headingStructure) {
    console.error('❌ No heading structure found in result!');
    process.exit(1);
  }

  const { headings, issues } = headingStructure;

  // Display statistics
  const stats = {
    h1: headings.filter(h => h.level === 1).length,
    h2: headings.filter(h => h.level === 2).length,
    h3: headings.filter(h => h.level === 3).length,
    h4: headings.filter(h => h.level === 4).length,
    h5: headings.filter(h => h.level === 5).length,
    h6: headings.filter(h => h.level === 6).length,
  };

  console.log('\n📊 Statistiky:');
  console.log(`Total Headings: ${headings.length}`);
  console.log(`  H1: ${stats.h1}`);
  console.log(`  H2: ${stats.h2}`);
  console.log(`  H3: ${stats.h3}`);
  console.log(`  H4: ${stats.h4}`);
  console.log(`  H5: ${stats.h5}`);
  console.log(`  H6: ${stats.h6}`);

  console.log('\n============================================================');
  console.log('🔍 Detected Issues');
  console.log('============================================================\n');
  console.log(`Found ${issues.length} issue types:\n`);

  const issueTypes = new Set(issues.map(i => i.type));
  
  const issueLabels: Record<string, string> = {
    'missing-h1': '🔴 MISSING-H1',
    'multiple-h1': '🔴 MULTIPLE-H1',
    'skipped-level': '⚠️ SKIPPED-LEVEL',
    'empty-heading': '🚫 EMPTY-HEADING',
    'first-not-h1': '⬆️ FIRST-NOT-H1',
    'duplicate-headings': '📋 DUPLICATE-HEADINGS',
    'generic-heading': '❓ GENERIC-HEADING',
    'very-long-heading': '📏 VERY-LONG-HEADING',
    'very-short-heading': '📉 VERY-SHORT-HEADING'
  };

  issues.forEach((issue, idx) => {
    console.log(`${idx + 1}. ${issueLabels[issue.type] || issue.type.toUpperCase()}`);
    console.log(`   ${issue.description}`);
    if (issue.wcagReference) {
      console.log(`   WCAG: ${issue.wcagReference}`);
    }
    if (issue.affectedHeadings && issue.affectedHeadings.length > 0) {
      console.log(`   Affected elements: ${issue.affectedHeadings.length}`);
      issue.affectedHeadings.slice(0, 3).forEach(h => {
        const text = h.text || '(empty)';
        const truncated = text.length > 60 ? text.substring(0, 60) + '...' : text;
        console.log(`     - H${h.level}: "${truncated}"`);
      });
      if (issue.affectedHeadings.length > 3) {
        console.log(`     ... and ${issue.affectedHeadings.length - 3} more`);
      }
    }
    console.log('');
  });

  // Expectations
  console.log('============================================================');
  console.log('🎯 Detection Coverage');
  console.log('============================================================\n');

  const expectedIssues: Array<'missing-h1' | 'multiple-h1' | 'skipped-level' | 'empty-heading' | 'first-not-h1' | 'duplicate-headings' | 'generic-heading' | 'very-long-heading' | 'very-short-heading'> = [
    'missing-h1',
    'multiple-h1',
    'skipped-level',
    'empty-heading',
    'first-not-h1',
    'duplicate-headings',
    'generic-heading',
    'very-long-heading',
    'very-short-heading'
  ];

  let allDetected = true;
  expectedIssues.forEach(expected => {
    const detected = issueTypes.has(expected);
    const symbol = detected ? '✓' : '✗';
    const label = issueLabels[expected] || expected.toUpperCase();
    console.log(`${symbol} ${label}: ${detected ? 'DETECTED' : 'NOT DETECTED'}`);
    if (!detected) allDetected = false;
  });

  console.log(`\nCoverage: ${issueTypes.size}/${expectedIssues.length} types detected\n`);

  // Save reports
  const jsonPath = path.join(__dirname, 'test-all-detections-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`📄 JSON report saved: ${jsonPath}\n`);

  // Generate HTML report
  console.log('============================================================');
  console.log('🎨 Generating HTML Report');
  console.log('============================================================\n');

  try {
    const generateReport = require('./generate-html-report');
    const htmlPath = path.join(__dirname, 'test-all-detections-report.html');
    console.log(`Report generated: ${htmlPath}\n`);
    
    const htmlContent = generateReport(result);
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`✅ HTML report saved: ${htmlPath}\n`);

    console.log('============================================================');
    if (allDetected) {
      console.log('✅ All Issue Types Detected Successfully!');
    } else {
      console.log('⚠️ Some Issue Types Not Detected');
    }
    console.log('============================================================\n');

    console.log('\nOpen reports:');
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  JSON: ${jsonPath}\n`);

    process.exit(allDetected ? 0 : 1);

  } catch (error) {
    console.error('Error generating HTML report:', error);
    process.exit(1);
  }

}).catch(error => {
  console.error('❌ Scan failed:', error);
  process.exit(1);
});
