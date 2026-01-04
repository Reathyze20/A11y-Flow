#!/usr/bin/env node

/**
 * A11y Flow - Modular HTML Report Generator
 * Version 2.0
 * 
 * Generates accessible, responsive HTML reports from JSON scan data.
 * Supports both single-page and multi-page (crawl) modes.
 * 
 * Usage: node generate-html-report-v2.js <input.json>
 */

const fs = require('fs');
const path = require('path');

// Import modules
const { escapeHtml } = require('./report-modules/utils');
const getStyles = require('./report-modules/styles');
const generateHeader = require('./report-modules/header');
const generateSidebar = require('./report-modules/sidebar');
const generateSinglePageSummary = require('./report-modules/summary-single');
const generateCrawlSummary = require('./report-modules/summary-crawl');
const generatePerformance = require('./report-modules/performance');
const generateHeadingStructure = require('./report-modules/heading-structure');
const getScripts = require('./report-modules/scripts');
const { generatePageModal, generateModalScripts } = require('./report-modules/page-modal');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node generate-html-report.js <input.json>');
  process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = inputPath.replace(/\.json$/i, '.html');

// Load JSON data
let data;
try {
  const jsonContent = fs.readFileSync(inputPath, 'utf-8');
  data = JSON.parse(jsonContent);
} catch (err) {
  console.error('Failed to read or parse JSON report:', err.message);
  process.exit(1);
}

// Detect mode
const isCrawl = Array.isArray(data.pages);

// Calculate statistics
const stats = isCrawl ? calculateCrawlStats(data) : calculateSinglePageStats(data);

function calculateSinglePageStats(data) {
  const stats = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    total: 0
  };

  // Handle both array and object format for violations
  let violations = [];
  if (Array.isArray(data.violations)) {
    violations = data.violations;
  } else if (data.violations && typeof data.violations === 'object') {
    // Flatten object format: { critical: [], serious: [], ... }
    ['critical', 'serious', 'moderate', 'minor'].forEach(severity => {
      if (Array.isArray(data.violations[severity])) {
        violations = violations.concat(data.violations[severity].map(v => ({ ...v, impact: severity })));
      }
    });
  }

  violations.forEach(v => {
    const impact = (v.impact || 'minor').toLowerCase();
    stats.total++;
    if (stats[impact] !== undefined) {
      stats[impact]++;
    } else {
      stats.minor++;
    }
  });

  // Also flatten violations for easier access in templates
  data.violationsArray = violations;

  return stats;
}

function calculateCrawlStats(data) {
  const stats = {
    totalCritical: 0,
    totalSerious: 0,
    totalModerate: 0,
    total: 0
  };

  (data.pages || []).forEach(page => {
    (page.violations || []).forEach(v => {
      const impact = (v.impact || 'minor').toLowerCase();
      stats.total++;
      if (impact === 'critical') stats.totalCritical++;
      else if (impact === 'serious') stats.totalSerious++;
      else stats.totalModerate++;
    });
  });

  return stats;
}

// Generate HTML content sections
const headerHtml = generateHeader(data, isCrawl);
const sidebarHtml = generateSidebar(stats, isCrawl);

const summaryHtml = isCrawl 
  ? generateCrawlSummary(data)
  : generateSinglePageSummary(data, stats);

const performanceHtml = `
  <section id="tab-performance" class="hidden">
    ${generatePerformance(data, isCrawl)}
  </section>
`;

const structureHtml = `
  <section id="tab-structure" class="hidden">
    ${generateHeadingStructure(data, isCrawl)}
  </section>
`;

// Assemble complete HTML document
const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report - ${escapeHtml(isCrawl ? data.rootUrl : data.url)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: '#2563eb',
            bgDark: '#0f172a',
            cardDark: '#1e293b',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#3b82f6'
          }
        }
      }
    }
  </script>
  ${getStyles()}
</head>
<body class="bg-bgDark text-gray-200 font-sans h-screen flex overflow-hidden">

  ${sidebarHtml}

  <main class="flex-1 overflow-y-auto relative scroll-smooth p-8">
    ${headerHtml}
    
    <div id="content-area">
      ${summaryHtml}
      ${performanceHtml}
      ${structureHtml}
    </div>
  </main>

  ${isCrawl ? generatePageModal() : ''}

  ${getScripts()}
  ${isCrawl ? generateModalScripts(data.pages || []) : ''}
</body>
</html>`;

// Write output
fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`Report generated: ${outputPath}`);
