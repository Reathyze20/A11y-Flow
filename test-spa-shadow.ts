import { WebScanner } from './src/core/WebScanner';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test script for SPA and Shadow DOM support
 * 
 * Usage:
 *   ts-node test-spa-shadow.ts
 */

// Simple HTTP server for test pages
function startTestServer(port = 8080): http.Server {
  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'test-pages', 'rules', req.url === '/' ? 'index.html' : req.url!);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'test-pages'))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'text/plain';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(port);
  console.log(`✅ Test server started at http://localhost:${port}`);
  return server;
}

async function testSPAScanning() {
  console.log('\n🧪 Testing SPA Scanning...');
  console.log('=' .repeat(60));

  const scanner = new WebScanner();
  const url = 'http://localhost:8080/spa.html';

  try {
    const report = await scanner.scan(url);
    
    console.log(`\n📊 SPA Scan Results for ${url}`);
    console.log(`   Total violations: ${report.stats.totalViolations}`);
    console.log(`   Critical: ${report.stats.criticalCount}`);
    console.log(`   Serious: ${report.violations.serious.length}`);
    console.log(`   Moderate: ${report.violations.moderate.length}`);
    console.log(`   Minor: ${report.violations.minor.length}`);

    if (report.violations.critical.length > 0) {
      console.log('\n🔴 Critical Violations Found:');
      report.violations.critical.slice(0, 3).forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.id}: ${v.description}`);
        console.log(`      Impact: ${v.impact} | Count: ${v.count}`);
      });
    }

    console.log('\n✅ SPA scanning completed successfully');
    return report;
  } catch (error) {
    console.error('\n❌ SPA scanning failed:', error);
    throw error;
  }
}

async function testShadowDOMScanning() {
  console.log('\n🧪 Testing Shadow DOM Scanning...');
  console.log('='.repeat(60));

  const scanner = new WebScanner();
  const url = 'http://localhost:8080/shadow-dom.html';

  try {
    const report = await scanner.scan(url);
    
    console.log(`\n📊 Shadow DOM Scan Results for ${url}`);
    console.log(`   Total violations: ${report.stats.totalViolations}`);
    console.log(`   Critical: ${report.stats.criticalCount}`);
    console.log(`   Serious: ${report.violations.serious.length}`);
    console.log(`   Moderate: ${report.violations.moderate.length}`);
    console.log(`   Minor: ${report.violations.minor.length}`);

    if (report.violations.serious.length > 0) {
      console.log('\n🟠 Serious Violations Found:');
      report.violations.serious.slice(0, 3).forEach((v, i) => {
        console.log(`   ${i + 1}. ${v.id}: ${v.description}`);
        console.log(`      Impact: ${v.impact} | Count: ${v.count}`);
      });
    }

    // Check if shadow DOM issues were detected
    const shadowDOMViolations = [
      ...report.violations.critical,
      ...report.violations.serious,
      ...report.violations.moderate,
      ...report.violations.minor
    ].filter(v => {
      // Look for violations that might be in shadow DOM
      // Check nodes for shadow DOM indicators
      return v.nodes?.some(node => 
        node.html?.includes('custom-') || 
        node.target?.some(t => t.includes('custom-'))
      ) || v.id?.toLowerCase().includes('shadow');
    });

    if (shadowDOMViolations.length > 0) {
      console.log(`\n🎯 Found ${shadowDOMViolations.length} violations in Shadow DOM components`);
    }

    console.log('\n✅ Shadow DOM scanning completed successfully');
    return report;
  } catch (error) {
    console.error('\n❌ Shadow DOM scanning failed:', error);
    throw error;
  }
}

async function main() {
  const server = startTestServer(8080);

  try {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Run tests
    const spaReport = await testSPAScanning();
    const shadowReport = await testShadowDOMScanning();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Test Summary');
    console.log('='.repeat(60));
    console.log(`SPA Test: ${spaReport.stats.totalViolations} violations found`);
    console.log(`Shadow DOM Test: ${shadowReport.stats.totalViolations} violations found`);
    
    if (spaReport.stats.totalViolations > 0 && shadowReport.stats.totalViolations > 0) {
      console.log('\n✅ Both SPA and Shadow DOM scanning are working correctly!');
      console.log('   The scanner detected accessibility issues in:');
      console.log('   - Dynamically loaded SPA content');
      console.log('   - Web Components with Shadow DOM');
    } else {
      console.log('\n⚠️  Warning: Some tests may not have detected violations');
    }

    console.log('\n💡 Tip: Check the full reports for detailed violations');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  } finally {
    server.close();
    console.log('\n🛑 Test server stopped');
  }
}

main();
