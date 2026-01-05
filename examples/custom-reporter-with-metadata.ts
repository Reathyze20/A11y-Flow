/**
 * Example: Using SPA & Shadow DOM metadata in custom reporter
 * 
 * This shows how to consume the metadata from scan results
 */

import { WebScanner } from './src/core/WebScanner';
import { AccessibilityDiffer } from './src/core/Differ';
import * as fs from 'fs';

async function customReporterExample() {
  console.log('🔍 Custom Reporter Example with SPA/Shadow DOM Metadata\n');

  // 1. Perform scan
  console.log('Scanning application...');
  const scanner = new WebScanner();
  const report = await scanner.scan('https://your-app.com');

  // 2. Access SPA metadata
  if (report.spaMetadata) {
    console.log('\n📱 SPA Information:');
    console.log(`  Framework: ${report.spaMetadata.detectedFramework}`);
    console.log(`  Client-side routing: ${report.spaMetadata.hasClientSideRouting}`);
    console.log(`  Hydration time: ${report.spaMetadata.hydrationTime}ms`);
    console.log(`  Page stability: ${report.spaMetadata.stabilityTime}ms`);

    // Performance analysis
    if (report.spaMetadata.hydrationTime && report.spaMetadata.hydrationTime > 1000) {
      console.log('  ⚠️ Slow hydration detected!');
    }
  }

  // 3. Access Shadow DOM metadata
  if (report.shadowDOMMetadata && report.shadowDOMMetadata.hasShadowDOM) {
    console.log('\n🎯 Shadow DOM Information:');
    console.log(`  Shadow roots: ${report.shadowDOMMetadata.shadowHostCount}`);
    console.log(`  Web components: ${report.shadowDOMMetadata.webComponents.length}`);
    
    if (report.shadowDOMMetadata.webComponents.length > 0) {
      console.log(`  Components: ${report.shadowDOMMetadata.webComponents.slice(0, 5).join(', ')}`);
    }

    // Security warning
    if (report.shadowDOMMetadata.closedShadowRoots > 0) {
      console.log(`  ⚠️ Warning: ${report.shadowDOMMetadata.closedShadowRoots} closed shadow roots detected`);
      console.log('     Closed shadow roots cannot be scanned for accessibility issues!');
    }
  }

  // 4. Custom analysis based on tech stack
  const techStack = analyzeTechStack(report);
  console.log('\n🔧 Technology Stack Analysis:');
  console.log(`  Type: ${techStack.type}`);
  console.log(`  Complexity: ${techStack.complexity}`);
  console.log(`  Recommended scan frequency: ${techStack.recommendedFrequency}`);

  // 5. Generate custom report
  const customReport = generateCustomReport(report);
  fs.writeFileSync('custom-report.json', JSON.stringify(customReport, null, 2));
  console.log('\n✅ Custom report saved to custom-report.json');
}

/**
 * Analyze technology stack based on metadata
 */
function analyzeTechStack(report: any) {
  const hasSPA = report.spaMetadata != null;
  const hasShadowDOM = report.shadowDOMMetadata?.hasShadowDOM ?? false;
  const componentCount = report.shadowDOMMetadata?.webComponents?.length ?? 0;

  let type = 'Static';
  let complexity = 'Low';
  let recommendedFrequency = 'Monthly';

  if (hasSPA && hasShadowDOM) {
    type = 'Modern SPA with Web Components';
    complexity = 'High';
    recommendedFrequency = 'Daily';
  } else if (hasSPA) {
    type = 'Single Page Application';
    complexity = 'Medium';
    recommendedFrequency = 'Weekly';
  } else if (hasShadowDOM) {
    type = 'Static site with Web Components';
    complexity = 'Medium';
    recommendedFrequency = 'Weekly';
  }

  return { type, complexity, recommendedFrequency };
}

/**
 * Generate custom report format with metadata
 */
function generateCustomReport(report: any) {
  return {
    meta: {
      url: report.url,
      timestamp: report.timestamp,
      score: report.score,
    },
    
    technology: {
      spa: report.spaMetadata ? {
        framework: report.spaMetadata.detectedFramework,
        routing: report.spaMetadata.hasClientSideRouting ? 'client-side' : 'server-side',
        performance: {
          hydrationMs: report.spaMetadata.hydrationTime,
          stabilityMs: report.spaMetadata.stabilityTime,
        },
      } : null,
      
      webComponents: report.shadowDOMMetadata ? {
        enabled: true,
        count: report.shadowDOMMetadata.shadowHostCount,
        components: report.shadowDOMMetadata.webComponents,
        warnings: report.shadowDOMMetadata.closedShadowRoots > 0 ? [
          `${report.shadowDOMMetadata.closedShadowRoots} closed shadow roots detected`
        ] : [],
      } : null,
    },
    
    accessibility: {
      totalIssues: report.stats.totalViolations,
      criticalIssues: report.stats.criticalCount,
      score: report.score,
      violations: {
        critical: report.violations.critical.length,
        serious: report.violations.serious.length,
        moderate: report.violations.moderate.length,
        minor: report.violations.minor.length,
      },
    },
    
    recommendations: generateRecommendations(report),
  };
}

/**
 * Generate recommendations based on metadata
 */
function generateRecommendations(report: any) {
  const recommendations: string[] = [];

  // SPA-specific recommendations
  if (report.spaMetadata) {
    if (report.spaMetadata.hydrationTime > 1000) {
      recommendations.push('Consider optimizing hydration time (currently >1s)');
    }
    
    if (report.spaMetadata.hasClientSideRouting) {
      recommendations.push('Ensure focus management after client-side navigation');
      recommendations.push('Add ARIA live regions for route changes');
    }
  }

  // Shadow DOM-specific recommendations
  if (report.shadowDOMMetadata?.hasShadowDOM) {
    if (report.shadowDOMMetadata.closedShadowRoots > 0) {
      recommendations.push(`Change ${report.shadowDOMMetadata.closedShadowRoots} closed shadow roots to open mode`);
    }
    
    recommendations.push('Verify ARIA attributes work across shadow boundaries');
    recommendations.push('Test keyboard navigation in shadow DOM components');
  }

  // General recommendations
  if (report.stats.criticalCount > 0) {
    recommendations.push(`Fix ${report.stats.criticalCount} critical accessibility issues immediately`);
  }

  return recommendations;
}

// Example usage with diff analysis
async function diffWithMetadataExample() {
  console.log('\n📊 Diff Analysis with Metadata Example\n');

  // Load baseline and current scans
  const baseline = JSON.parse(fs.readFileSync('baseline.json', 'utf-8'));
  const current = JSON.parse(fs.readFileSync('current.json', 'utf-8'));

  // Perform diff
  const differ = new AccessibilityDiffer();
  const diff = differ.diff(baseline, current);

  // Generate markdown with metadata
  const markdown = differ.formatAsMarkdown(diff, current, {
    includeDetails: true,
    reportUrl: 'https://reports.example.com/123',
  });

  // Save markdown
  fs.writeFileSync('diff-with-metadata.md', markdown);
  console.log('✅ Diff report with metadata saved');

  // Analyze technology changes
  if (baseline.spaMetadata && current.spaMetadata) {
    const hydrationDiff = current.spaMetadata.hydrationTime - baseline.spaMetadata.hydrationTime;
    
    console.log('\n⚡ Performance Comparison:');
    console.log(`  Hydration time: ${baseline.spaMetadata.hydrationTime}ms → ${current.spaMetadata.hydrationTime}ms`);
    
    if (hydrationDiff > 200) {
      console.log('  ⚠️ Hydration is slower by ${hydrationDiff}ms!');
    } else if (hydrationDiff < -200) {
      console.log('  ✅ Hydration improved by ${Math.abs(hydrationDiff)}ms!');
    }
  }
}

// Run example
if (require.main === module) {
  customReporterExample()
    .then(() => diffWithMetadataExample())
    .catch(console.error);
}

export {
  customReporterExample,
  diffWithMetadataExample,
  analyzeTechStack,
  generateCustomReport,
  generateRecommendations,
};
