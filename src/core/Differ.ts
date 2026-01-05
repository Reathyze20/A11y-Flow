import { AuditReport, AccessibilityViolation } from './types';

/**
 * Result of comparing two accessibility scans
 */
export interface DiffResult {
  /** Newly introduced violations (regressions) */
  newIssues: AccessibilityViolation[];
  
  /** Violations that were fixed */
  fixedIssues: AccessibilityViolation[];
  
  /** Violations present in both scans */
  unchangedIssues: AccessibilityViolation[];
  
  /** Change in accessibility score */
  scoreChange: number;
  
  /** Baseline (production) score */
  baselineScore: number;
  
  /** Current (PR) score */
  currentScore: number;
  
  /** Summary statistics */
  summary: {
    totalNew: number;
    totalFixed: number;
    totalUnchanged: number;
    criticalNew: number;
    seriousNew: number;
    netChange: number; // positive = improvement
  };
}

/**
 * Compares two accessibility scan results to identify regressions and improvements
 */
export class AccessibilityDiffer {
  /**
   * Compare baseline (production) scan with current (PR) scan
   * @param baseline - Production scan results
   * @param current - Current/PR scan results
   * @returns Diff analysis showing new issues, fixes, and score changes
   */
  diff(baseline: AuditReport, current: AuditReport): DiffResult {
    // Flatten violations from both scans
    const baselineViolations = this.flattenViolations(baseline);
    const currentViolations = this.flattenViolations(current);
    
    // Create fingerprint sets for fast lookup
    const baselineFingerprints = new Map(
      baselineViolations.map(v => [this.getViolationFingerprint(v), v])
    );
    
    const currentFingerprints = new Map(
      currentViolations.map(v => [this.getViolationFingerprint(v), v])
    );
    
    // Find new issues (regressions)
    const newIssues = currentViolations.filter(
      v => !baselineFingerprints.has(this.getViolationFingerprint(v))
    );
    
    // Find fixed issues (improvements)
    const fixedIssues = baselineViolations.filter(
      v => !currentFingerprints.has(this.getViolationFingerprint(v))
    );
    
    // Find unchanged issues
    const unchangedIssues = currentViolations.filter(
      v => baselineFingerprints.has(this.getViolationFingerprint(v))
    );
    
    // Calculate score change
    const baselineScore = baseline.score || 0;
    const currentScore = current.score || 0;
    const scoreChange = currentScore - baselineScore;
    
    // Count by severity
    const criticalNew = newIssues.filter(v => v.impact === 'critical').length;
    const seriousNew = newIssues.filter(v => v.impact === 'serious').length;
    
    // Net change: positive means improvement (more fixes than new issues)
    const netChange = fixedIssues.length - newIssues.length;
    
    return {
      newIssues,
      fixedIssues,
      unchangedIssues,
      scoreChange,
      baselineScore,
      currentScore,
      summary: {
        totalNew: newIssues.length,
        totalFixed: fixedIssues.length,
        totalUnchanged: unchangedIssues.length,
        criticalNew,
        seriousNew,
        netChange
      }
    };
  }
  
  /**
   * Generate unique fingerprint for a violation
   * Combines rule ID with element selector for precise matching
   */
  private getViolationFingerprint(violation: AccessibilityViolation): string {
    // Use first node's target as identifier
    const target = violation.nodes?.[0]?.target?.join(',') || '';
    
    // Combine rule ID with element selector
    // This allows detecting when same rule is violated on different elements
    return `${violation.id}:${target}`;
  }
  
  /**
   * Flatten violations from report structure
   * Handles both array and object formats
   */
  private flattenViolations(report: AuditReport): AccessibilityViolation[] {
    if (!report.violations) {
      return [];
    }
    
    // If violations is already an array
    if (Array.isArray(report.violations)) {
      return report.violations;
    }
    
    // If violations is grouped by severity (object format)
    const violations: AccessibilityViolation[] = [];
    for (const severity of ['critical', 'serious', 'moderate', 'minor']) {
      const severityViolations = (report.violations as any)[severity];
      if (Array.isArray(severityViolations)) {
        violations.push(...severityViolations);
      }
    }
    
    return violations;
  }
  
  /**
   * Format diff result as markdown for PR comments
   */
  formatAsMarkdown(diff: DiffResult, currentReport: AuditReport, options?: {
    includeDetails?: boolean;
    reportUrl?: string;
  }): string {
    const { summary, scoreChange, baselineScore, currentScore } = diff;
    const { includeDetails = true, reportUrl } = options || {};
    
    let markdown = '## 🎯 Accessibility Changes\n\n';
    
    // Status emoji based on net change
    const statusEmoji = summary.netChange > 0 ? '✅' : 
                       summary.netChange < 0 ? '⚠️' : '➖';
    
    // Improvements section
    if (summary.totalFixed > 0) {
      markdown += `### ✅ Improvements (${summary.totalFixed})\n`;
      
      if (includeDetails && diff.fixedIssues.length <= 10) {
        for (const issue of diff.fixedIssues.slice(0, 10)) {
          markdown += `- **Fixed:** ${issue.title}\n`;
        }
      } else if (summary.totalFixed > 10) {
        markdown += `- ${summary.totalFixed} issues were resolved\n`;
      }
      markdown += '\n';
    }
    
    // New issues section (regressions)
    if (summary.totalNew > 0) {
      const severityLabel = summary.criticalNew > 0 ? '🔴 Critical' : 
                           summary.seriousNew > 0 ? '🟡 Serious' : '⚪';
      
      markdown += `### ⚠️ New Issues (${summary.totalNew}) ${severityLabel}\n`;
      
      if (includeDetails && diff.newIssues.length <= 10) {
        for (const issue of diff.newIssues.slice(0, 10)) {
          const impactBadge = this.getImpactBadge(issue.impact || 'moderate');
          markdown += `- ${impactBadge} **${issue.title}**\n`;
          
          if (issue.nodes?.[0]) {
            const node = issue.nodes[0];
            if (node.html) {
              markdown += `  - Element: \`${node.html.substring(0, 80)}${node.html.length > 80 ? '...' : ''}\`\n`;
            }
            if (node.failureSummary) {
              markdown += `  - Fix: ${node.failureSummary}\n`;
            }
          }
        }
      } else if (summary.totalNew > 10) {
        markdown += `- ${summary.criticalNew} critical, ${summary.seriousNew} serious, and ${summary.totalNew - summary.criticalNew - summary.seriousNew} other issues\n`;
      }
      markdown += '\n';
    }
    
    // Summary section
    markdown += '### 📊 Summary\n';
    markdown += `- **Before:** ${summary.totalUnchanged + summary.totalFixed} issues (Score: ${baselineScore})\n`;
    markdown += `- **After:** ${summary.totalUnchanged + summary.totalNew} issues (Score: ${currentScore})\n`;
    
    const netChangeLabel = summary.netChange > 0 ? `✅ +${summary.netChange} (improved)` :
                          summary.netChange < 0 ? `⚠️ ${summary.netChange} (regressed)` :
                          '➖ No change';
    markdown += `- **Net Change:** ${netChangeLabel}\n`;
    
    if (scoreChange !== 0) {
      const scoreChangeLabel = scoreChange > 0 ? `+${scoreChange.toFixed(1)}` : scoreChange.toFixed(1);
      markdown += `- **Score Change:** ${scoreChangeLabel} points\n`;
    }
    
    // Add SPA/Shadow DOM metadata if present
    markdown = this.addTechnicalMetadataToMarkdown(markdown, diff, currentReport);
    
    // Report link
    if (reportUrl) {
      markdown += '\n<details>\n';
      markdown += '<summary>View full report</summary>\n\n';
      markdown += `[Full HTML report](${reportUrl})\n`;
      markdown += '</details>\n';
    }
    
    return markdown;
  }
  
  /**
   * Add technical metadata (SPA/Shadow DOM) to markdown report
   */
  private addTechnicalMetadataToMarkdown(markdown: string, diff: DiffResult, currentReport: AuditReport): string {
    const spa = currentReport.spaMetadata;
    const shadow = currentReport.shadowDOMMetadata;
    
    if (!spa && !shadow) {
      return markdown;
    }
    
    markdown += '\n### 🔧 Technical Details\n';
    
    if (spa) {
      const frameworkIcons: Record<string, string> = {
        react: '⚛️ React',
        vue: '💚 Vue',
        angular: '🅰️ Angular',
        unknown: '🚀 Unknown SPA'
      };
      const frameworkLabel = frameworkIcons[spa.detectedFramework || 'unknown'] || '🚀 Unknown';
      markdown += `- **Framework:** ${frameworkLabel}\n`;
      
      if (spa.hasClientSideRouting) {
        markdown += '- **Routing:** Client-side\n';
      }
      
      if (spa.hydrationTime != null) {
        markdown += `- **Hydration Time:** ${spa.hydrationTime}ms\n`;
      }
      
      if (spa.stabilityTime != null) {
        markdown += `- **Page Stability:** ${spa.stabilityTime}ms\n`;
      }
    }
    
    if (shadow && shadow.hasShadowDOM) {
      markdown += `- **Shadow DOM:** ${shadow.shadowHostCount} shadow root(s)\n`;
      
      if (shadow.webComponents && shadow.webComponents.length > 0) {
        const componentsList = shadow.webComponents.slice(0, 5).join(', ');
        const moreText = shadow.webComponents.length > 5 ? ` +${shadow.webComponents.length - 5} more` : '';
        markdown += `- **Web Components:** ${componentsList}${moreText}\n`;
      }
      
      if (shadow.closedShadowRoots > 0) {
        markdown += `- ⚠️ **Warning:** ${shadow.closedShadowRoots} closed shadow root(s) could not be scanned\n`;
      }
    }
    
    return markdown;
  }
  
  /**
   * Get emoji badge for impact level
   */
  private getImpactBadge(impact?: string): string {
    switch (impact) {
      case 'critical': return '🔴';
      case 'serious': return '🟡';
      case 'moderate': return '🟠';
      case 'minor': return '⚪';
      default: return '⚪';
    }
  }
  
  /**
   * Check if diff meets success criteria
   */
  shouldPass(diff: DiffResult, options?: {
    maxNewIssues?: number;
    maxCriticalIssues?: number;
    minScoreChange?: number;
    allowRegression?: boolean;
  }): { passed: boolean; reason?: string } {
    const {
      maxNewIssues = 0,
      maxCriticalIssues = 0,
      minScoreChange = -5,
      allowRegression = false
    } = options || {};
    
    // Check critical issues
    if (diff.summary.criticalNew > maxCriticalIssues) {
      return {
        passed: false,
        reason: `${diff.summary.criticalNew} new critical issues (max allowed: ${maxCriticalIssues})`
      };
    }
    
    // Check total new issues
    if (diff.summary.totalNew > maxNewIssues) {
      return {
        passed: false,
        reason: `${diff.summary.totalNew} new issues (max allowed: ${maxNewIssues})`
      };
    }
    
    // Check score change
    if (diff.scoreChange < minScoreChange) {
      return {
        passed: false,
        reason: `Score decreased by ${Math.abs(diff.scoreChange).toFixed(1)} points (min allowed: ${minScoreChange})`
      };
    }
    
    // Check regression
    if (!allowRegression && diff.summary.netChange < 0) {
      return {
        passed: false,
        reason: `Regression detected: ${Math.abs(diff.summary.netChange)} more issues than fixes`
      };
    }
    
    return { passed: true };
  }
}
