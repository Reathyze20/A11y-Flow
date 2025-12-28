import { AxeResults, Result } from 'axe-core';
import { AuditReport, AccessibilityViolation, ViolationNode, ImpactLevel } from './types';

/**
 * PURE LOGIC: Transformuje surová data z Axe-core na čistý AuditReport.
 * Obsahuje logiku pro výpočet skóre.
 */
export class ViolationMapper {
  
  public static mapToReport(url: string, rawResults: AxeResults): AuditReport {
    const violations: Result[] = rawResults.violations;
    
    // Třídění chyb podle závažnosti
    const groupedViolations = {
      critical: this.mapViolations(violations.filter((v: Result) => v.impact === 'critical')),
      serious: this.mapViolations(violations.filter((v: Result) => v.impact === 'serious')),
      moderate: this.mapViolations(violations.filter((v: Result) => v.impact === 'moderate')),
      minor: this.mapViolations(violations.filter((v: Result) => v.impact === 'minor')),
    };

    const totalViolations = violations.reduce((acc: number, v: Result) => acc + v.nodes.length, 0);
    const criticalCount = groupedViolations.critical.reduce((acc, v) => acc + v.count, 0);

    return {
      url: url,
      timestamp: rawResults.timestamp,
      score: this.calculateScore(violations), 
      meta: {
        browserVersion: rawResults.testEngine.name + ' ' + rawResults.testEngine.version,
        engineVersion: rawResults.testEngine.version,
      },
      violations: groupedViolations,
      stats: {
        totalViolations,
        criticalCount
      }
    };
  }

  // Helper pro mapování pole výsledků
  private static mapViolations(results: Result[]): AccessibilityViolation[] {
    return results.map((v: Result) => ({
      id: v.id,
      title: v.help,
      description: v.description,
      impact: v.impact as ImpactLevel,
      helpUrl: v.helpUrl,
      count: v.nodes.length,
      nodes: v.nodes.map((n): ViolationNode => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary || 'No summary available'
      } as ViolationNode))
    }));
  }

  /**
   * Výpočet skóre přístupnosti (Heuristika).
   * Start: 100 bodů.
   * Penalizace: Critical -5, Serious -3, Moderate -1, Minor -0.5 (za každý výskyt).
   */
  private static calculateScore(violations: Result[]): number {
    let score = 100;
    
    const penalties = {
      critical: 5,
      serious: 3,
      moderate: 1,
      minor: 0.5
    };

    violations.forEach(v => {
      const weight = penalties[v.impact as keyof typeof penalties] || 0;
      // Penalizujeme každý výskyt chyby (node), ne jen typ chyby
      score -= (v.nodes.length * weight);
    });

    return Math.max(0, Math.round(score));
  }
}