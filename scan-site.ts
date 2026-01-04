import { WebScanner } from './src/core/WebScanner';
import * as fs from 'fs';
import * as path from 'path';

const url = process.argv[2] || 'https://www.wugi.cz';
const outputFile = process.argv[3] || 'real-site-report.json';

console.log(`\n🔍 Scanning: ${url}\n`);

const scanner = new WebScanner();

scanner.scan(url).then(result => {
  const jsonPath = path.join(__dirname, outputFile);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\n✅ JSON report saved: ${jsonPath}`);

  // Show heading structure summary
  const headingStructure = result.headingStructure;
  if (headingStructure) {
    const { headings, issues } = headingStructure;
    
    console.log('\n📊 Heading Structure Summary:');
    console.log(`   Total headings: ${headings.length}`);
    console.log(`   Issues found: ${issues.length}\n`);

    if (issues.length > 0) {
      console.log('   Issues:');
      issues.forEach((issue, idx) => {
        const affected = issue.affectedHeadings?.length || 0;
        console.log(`   ${idx + 1}. ${issue.type}: ${affected} elements`);
      });
    } else {
      console.log('   ✅ No heading structure issues!');
    }
  }

  // Generate HTML
  console.log('\n🎨 Generating HTML report...');
  try {
    const { exec } = require('child_process');
    exec(`node generate-html-report.js ${outputFile}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error generating HTML:', error);
        return;
      }
      console.log(stdout);
      const htmlPath = jsonPath.replace('.json', '.html');
      console.log(`✅ HTML report: ${htmlPath}\n`);
      
      // Open in browser
      exec(`start ${htmlPath}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }

}).catch(error => {
  console.error('❌ Scan failed:', error);
  process.exit(1);
});
