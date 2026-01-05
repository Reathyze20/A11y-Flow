#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');

// Version from package.json
const packageJson = require('../package.json');

program
  .name('a11y-flow')
  .description('Automated web accessibility testing with beautiful reports')
  .version(packageJson.version);

// Scan command
program
  .command('scan <url>')
  .description('Scan a single page for accessibility issues')
  .option('-o, --output <file>', 'Output file path (JSON)', 'report.json')
  .option('-f, --format <format>', 'Output format (json|html|both)', 'json')
  .option('-d, --device <device>', 'Device profile (desktop|mobile|tablet)', 'desktop')
  .option('--threshold <score>', 'Minimum accessibility score (0-100)', '0')
  .option('--fail-on-critical', 'Exit with code 1 if critical issues found', false)
  .action(async (url, options) => {
    console.log(`🔍 Scanning ${url}...`);
    
    try {
      // Dynamic import for ESM modules
      const { WebScanner } = await import('../dist/index.js');
      
      const scanner = new WebScanner();
      const result = await scanner.scanPage(url, {
        device: options.device
      });
      
      // Save JSON report
      const jsonPath = options.output;
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      console.log(`✅ JSON report saved: ${jsonPath}`);
      
      // Generate HTML if requested
      if (options.format === 'html' || options.format === 'both') {
        const htmlPath = jsonPath.replace(/\.json$/, '.html');
        const generateReport = require('../generate-html-report-v2.js');
        const html = generateReport(result);
        fs.writeFileSync(htmlPath, html);
        console.log(`✅ HTML report saved: ${htmlPath}`);
      }
      
      // Print summary
      console.log(`\n📊 Results:`);
      console.log(`   Score: ${result.score}/100`);
      console.log(`   Violations: ${result.violations?.length || 0}`);
      
      // Check thresholds
      const threshold = parseInt(options.threshold);
      if (result.score < threshold) {
        console.error(`\n❌ Score ${result.score} is below threshold ${threshold}`);
        process.exit(1);
      }
      
      if (options.failOnCritical) {
        const criticalCount = result.violations?.filter(v => v.impact === 'critical').length || 0;
        if (criticalCount > 0) {
          console.error(`\n❌ Found ${criticalCount} critical issues`);
          process.exit(1);
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Crawl command
program
  .command('crawl <url>')
  .description('Crawl multiple pages of a website')
  .option('-o, --output <file>', 'Output file path (JSON)', 'crawl-report.json')
  .option('-f, --format <format>', 'Output format (json|html|both)', 'json')
  .option('--max-pages <number>', 'Maximum pages to scan', '10')
  .option('--max-depth <number>', 'Maximum crawl depth', '3')
  .option('--threshold <score>', 'Minimum average score', '0')
  .action(async (url, options) => {
    console.log(`🕷️  Crawling ${url}...`);
    
    try {
      const { Crawler } = await import('../dist/index.js');
      
      const crawler = new Crawler();
      const result = await crawler.crawlSite(url, {
        maxPages: parseInt(options.maxPages),
        maxDepth: parseInt(options.maxDepth)
      });
      
      // Save JSON report
      const jsonPath = options.output;
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      console.log(`✅ JSON report saved: ${jsonPath}`);
      
      // Generate HTML if requested
      if (options.format === 'html' || options.format === 'both') {
        const htmlPath = jsonPath.replace(/\.json$/, '.html');
        const generateReport = require('../generate-html-report-v2.js');
        const html = generateReport(result);
        fs.writeFileSync(htmlPath, html);
        console.log(`✅ HTML report saved: ${htmlPath}`);
      }
      
      // Print summary
      console.log(`\n📊 Results:`);
      console.log(`   Pages scanned: ${result.totalPagesScanned}`);
      console.log(`   Average score: ${result.averageScore}/100`);
      console.log(`   Total violations: ${result.totalViolations}`);
      
      // Check threshold
      const threshold = parseInt(options.threshold);
      if (result.averageScore < threshold) {
        console.error(`\n❌ Average score ${result.averageScore} is below threshold ${threshold}`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Diff command
program
  .command('diff <baseline> <current>')
  .description('Compare two scan results to find regressions and improvements')
  .option('-o, --output <file>', 'Output file for diff report', 'diff-report.md')
  .option('-f, --format <format>', 'Output format (markdown|json)', 'markdown')
  .option('--max-new-issues <number>', 'Max allowed new issues', '0')
  .option('--max-critical <number>', 'Max allowed critical issues', '0')
  .option('--allow-regression', 'Allow regression (more issues than fixes)', false)
  .option('--exit-code', 'Exit with code 1 if checks fail', false)
  .option('--report-url <url>', 'URL to full report (for PR comments)')
  .action(async (baselinePath, currentPath, options) => {
    console.log(`🔄 Comparing ${baselinePath} with ${currentPath}...`);
    
    try {
      // Load scan results
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      const current = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
      
      // Import differ from main bundle
      const { AccessibilityDiffer } = await import('../dist/index.js');
      const differ = new AccessibilityDiffer();
      
      // Perform diff
      const diff = differ.diff(baseline, current);
      
      // Format output
      if (options.format === 'markdown') {
        const markdown = differ.formatAsMarkdown(diff, current, {
          includeDetails: true,
          reportUrl: options.reportUrl
        });
        
        fs.writeFileSync(options.output, markdown);
        console.log(`✅ Diff report saved: ${options.output}`);
        console.log('\n' + markdown);
      } else {
        fs.writeFileSync(options.output, JSON.stringify(diff, null, 2));
        console.log(`✅ Diff report saved: ${options.output}`);
      }
      
      // Print summary
      console.log(`\n📊 Summary:`);
      console.log(`   New issues: ${diff.summary.totalNew}`);
      console.log(`   Fixed issues: ${diff.summary.totalFixed}`);
      console.log(`   Net change: ${diff.summary.netChange > 0 ? '+' : ''}${diff.summary.netChange}`);
      console.log(`   Score change: ${diff.scoreChange > 0 ? '+' : ''}${diff.scoreChange.toFixed(1)}`);
      
      // Check if should pass
      if (options.exitCode) {
        const result = differ.shouldPass(diff, {
          maxNewIssues: parseInt(options.maxNewIssues),
          maxCriticalIssues: parseInt(options.maxCritical),
          allowRegression: options.allowRegression
        });
        
        if (!result.passed) {
          console.error(`\n❌ Check failed: ${result.reason}`);
          process.exit(1);
        } else {
          console.log(`\n✅ All checks passed`);
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Report command (generate HTML from JSON)
program
  .command('report <input>')
  .description('Generate HTML report from JSON scan results')
  .option('-o, --output <file>', 'Output HTML file path')
  .action((inputPath, options) => {
    console.log(`📄 Generating HTML report from ${inputPath}...`);
    
    try {
      const data = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
      const generateReport = require('../generate-html-report-v2.js');
      const html = generateReport(data);
      
      const outputPath = options.output || inputPath.replace(/\.json$/, '.html');
      fs.writeFileSync(outputPath, html);
      
      console.log(`✅ HTML report saved: ${outputPath}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
