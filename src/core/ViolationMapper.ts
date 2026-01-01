import { AxeResults, Result, NodeResult } from 'axe-core';
import { AuditReport, AccessibilityViolation, ViolationNode, ImpactLevel, HumanReadableActionItem } from './types';
import { RemediationService } from './RemediationService';
import { ActMapper } from './ActMapper';

export class ViolationMapper {
  
  public static mapToReport(url: string, rawResults: AxeResults): AuditReport {
    const violations = rawResults.violations;
    
    const groupedViolations = {
      critical: this.mapViolations(violations.filter(v => v.impact === 'critical'), url),
      serious: this.mapViolations(violations.filter(v => v.impact === 'serious'), url),
      moderate: this.mapViolations(violations.filter(v => v.impact === 'moderate'), url),
      minor: this.mapViolations(violations.filter(v => v.impact === 'minor'), url),
    };

    const totalViolations = violations.reduce((acc, v) => acc + v.nodes.length, 0);
    const criticalCount = groupedViolations.critical.reduce((acc, v) => acc + v.count, 0);

    // 1) Zploštělý seznam úkolů (humanReadable.actionItems)
    const actionItems: HumanReadableActionItem[] = violations.map(v => {
      const impact = v.impact as ImpactLevel | null;
      const priorityMeta = this.getPriorityMeta(impact);
      const ruleMeta = RemediationService.getRuleMeta(v.id);
      const actInfo = ActMapper.getActInfoForAxeRule(v.id);

      const firstNode = v.nodes && v.nodes[0];
      const technicalSummary =
        (firstNode && (firstNode as any).failureSummary) || undefined;

      const elementLabel = firstNode
        ? this.buildElementLabel(firstNode as unknown as NodeResult)
        : undefined;
      const exampleTarget = firstNode
        ? this.getFriendlySelector(firstNode as unknown as NodeResult) ||
          (Array.isArray(firstNode.target) ? String(firstNode.target[0]) : undefined)
        : undefined;

      const componentName = firstNode
        ? this.inferComponentName(firstNode as unknown as NodeResult)
        : undefined;
      const fingerprint = this.buildElementFingerprint(url, exampleTarget, elementLabel);

      let wcagReference = ruleMeta.wcag;
      if (!wcagReference) {
        wcagReference = this.extractWcagFromTags(v);
      }

      return {
        id: v.id,
        impact,
        priority: priorityMeta.label,
        category: ruleMeta.category,
        what: ruleMeta.what,
        fix: ruleMeta.fix,
        wcagReference,
        actRuleIds: actInfo?.actRuleIds,
        actRuleUrls: actInfo?.actRuleUrls,
        technicalSummary,
        exampleUrl: url,
        exampleTarget,
        elementLabel,
        fingerprint,
        componentName,
      };
    });

    // 2) Top 3 problémy podle závažnosti a počtu výskytů
    const topIssues = [...actionItems]
      .sort((a, b) => this.getPriorityMeta(b.impact).weight - this.getPriorityMeta(a.impact).weight)
      .slice(0, 3);

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
      },
      humanReadable: {
        actionItems,
        topIssues
      }
    };
  }

  private static mapViolations(results: Result[], pageUrl: string): AccessibilityViolation[] {
    return results.map(v => {
      const actInfo = ActMapper.getActInfoForAxeRule(v.id);

      return {
        id: v.id,
        title: v.help,
        description: v.description,
        impact: v.impact as ImpactLevel,
        helpUrl: v.helpUrl,
        count: v.nodes.length,
        suggestedFix: RemediationService.getFix(v.id),
        actRuleIds: actInfo?.actRuleIds,
        actRuleUrls: actInfo?.actRuleUrls,
        nodes: v.nodes.map((n) => {
          const node = n as unknown as NodeResult;
          const cssSelector =
            this.getFriendlySelector(node) ||
            (Array.isArray(node.target) ? String(node.target[0]) : undefined);
          const elementLabel = this.buildElementLabel(node);
          const componentName = this.inferComponentName(node);
          const fingerprint = this.buildElementFingerprint(pageUrl, cssSelector, elementLabel);

          return {
            html: n.html,
            target: n.target,
            failureSummary: n.failureSummary || 'No summary available',
            cssSelector,
            elementLabel,
            componentName,
            fingerprint,
          } as ViolationNode;
        }),
      } as AccessibilityViolation;
    });
  }

  private static getPriorityMeta(impact: ImpactLevel | null): { label: HumanReadableActionItem['priority']; weight: number } {
    switch (impact) {
      case 'critical':
        return { label: '🔴 Kritická', weight: 4 };
      case 'serious':
        return { label: '🟠 Vysoká', weight: 3 };
      case 'moderate':
        return { label: '🟡 Střední', weight: 2 };
      case 'minor':
        return { label: '🔵 Nízká', weight: 1 };
      default:
        return { label: '🔵 Nízká', weight: 1 };
    }
  }

  /**
   * Pokusí se odvodit konkrétní WCAG kritérium z tagů pravidla axe-core.
   * Axe typicky přidává tagy jako "wcag111", "wcag241" apod.
   */
  private static extractWcagFromTags(result: Result): string | undefined {
    if (!Array.isArray(result.tags)) return undefined;

    const raw = result.tags.find(t => /^wcag\d{3}$/.test(t));
    if (!raw) return undefined;

    const digits = raw.replace('wcag', ''); // např. "111"
    if (digits.length !== 3) return undefined;

    return `${digits[0]}.${digits[1]}.${digits[2]}`;
  }

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
      score -= (v.nodes.length * weight);
    });

    return Math.max(0, Math.round(score));
  }

  /**
   * Sestaví relativně stabilní fingerprint prvku z URL, selectoru a elementLabelu.
   * Není to kryptografický hash, ale deterministický identifikátor použitelný pro historii.
   */
  private static buildElementFingerprint(
    pageUrl: string,
    selector?: string,
    elementLabel?: string,
  ): string | undefined {
    if (!pageUrl && !selector && !elementLabel) return undefined;

    let pathPart = '';
    try {
      const u = new URL(pageUrl);
      pathPart = (u.pathname || '/').toLowerCase();
    } catch {
      pathPart = String(pageUrl || '').toLowerCase();
    }

    const sel = (selector || '').toLowerCase();
    const label = (elementLabel || '').toLowerCase();

    const raw = `${pathPart}::${sel}::${label}`;
    return raw || undefined;
  }

  /**
   * Pokusí se odvodit název komponenty / design‑system prvku z HTML atributů.
   * Preferuje data-* identifikátory (data-component, data-testid, ...), jinak
   * zkusí „zajímavé“ CSS třídy (obsahující např. btn, nav, link, input...).
   */
  private static inferComponentName(node: NodeResult): string | undefined {
    const html = node.html || '';
    const m = html.match(/<([a-zA-Z0-9-]+)([^>]*)>/);
    if (!m) return undefined;

    const attrs = m[2] || '';

    const readAttr = (name: string): string | undefined => {
      const re = new RegExp(name + '\\s*=\\s*"([^"]+)"', 'i');
      const match = attrs.match(re);
      return match && match[1] ? match[1].trim() : undefined;
    };

    const candidates: (string | undefined)[] = [
      readAttr('data-component'),
      readAttr('data-testid'),
      readAttr('data-cmp'),
      readAttr('data-ui'),
      readAttr('data-automation-id'),
    ];

    const fromData = candidates.find((v) => !!v);
    if (fromData) return fromData;

    const classAttr = readAttr('class');
    if (classAttr) {
      const interesting = classAttr
        .split(/\s+/)
        .filter(Boolean)
        .find((c) => /btn|button|nav|menu|link|input|field|form|card|modal/i.test(c));
      if (interesting) return interesting;
    }

    return undefined;
  }

  /**
   * Vygeneruje "lidsky čitelný" selector z axe NodeResultu.
   * Snaží se najít krátký identifikátor (ID nebo rozumnou třídu),
   * aby vývojář v UI hned viděl, kterého prvku se chyba týká.
   */
  private static getFriendlySelector(node: NodeResult): string | undefined {
    const rawTargets = Array.isArray(node.target) ? node.target : [];

    const genericTags = ['html', 'body', 'div', 'span', 'section', 'article'];

    // 1) Zkusíme vytáhnout něco smysluplného z target path (axe target)
    for (const t of rawTargets) {
      if (typeof t !== 'string') continue;

      const parts = t.split(/\s*>\s*|\s+/).filter(Boolean);
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (!part) continue;

        if (part.includes('#')) {
          return part.trim();
        }

        if (part.includes('.')) {
          const tag = part.split('.')[0];
          if (!genericTags.includes(tag.toLowerCase())) {
            return part.trim();
          }
        }
      }
    }

    // 2) Fallback: zkusíme HTML snippet a vytáhneme tag + id / třídy
    const html = node.html || '';
    const m = html.match(/<([a-zA-Z0-9-]+)([^>]*)>/);
    if (m) {
      const tag = m[1].toLowerCase();
      const attrs = m[2] || '';

      const idMatch = attrs.match(/id\s*=\s*"([^"]+)"/i);
      const classMatch = attrs.match(/class\s*=\s*"([^"]+)"/i);

      if (idMatch && idMatch[1]) {
        return `${tag}#${idMatch[1]}`;
      }

      if (classMatch && classMatch[1]) {
        const cls = classMatch[1]
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => `.${c}`)
          .join('');
        if (cls) {
          return `${tag}${cls}`;
        }
      }
    }

    // 3) Poslední nouzový fallback – první target jako celek (zkrácený)
    const first = rawTargets.find((t): t is string => typeof t === 'string');
    if (first) {
      return first.length > 80 ? first.slice(0, 77) + '…' : first;
    }

    return undefined;
  }

  /**
   * Vytvoří lidsky čitelný popis prvku na základě HTML snippetu a atributů.
   * Nesnaží se o plnou algoritmickou definici "accessible name", ale o
   * praktický popisek typu "Tlačítko \"Přihlásit se\"" nebo
   * "Odkaz \"Blog\"".
   */
  private static buildElementLabel(node: NodeResult): string | undefined {
    const html = node.html || '';
    const m = html.match(/<([a-zA-Z0-9-]+)([^>]*)>([\s\S]*?)<\/\1>/);
    const selfClosingMatch = html.match(/<([a-zA-Z0-9-]+)([^>]*)\/>/);

    let tag = '';
    let attrs = '';
    let inner = '';

    if (m) {
      tag = m[1].toLowerCase();
      attrs = m[2] || '';
      inner = m[3] || '';
    } else if (selfClosingMatch) {
      tag = selfClosingMatch[1].toLowerCase();
      attrs = selfClosingMatch[2] || '';
      inner = '';
    } else {
      return undefined;
    }

    const getAttr = (name: string): string | undefined => {
      const re = new RegExp(name + '\\s*=\\s*"([^"]+)"', 'i');
      const match = attrs.match(re);
      return match && match[1] ? match[1].trim() : undefined;
    };

    const ariaLabel = getAttr('aria-label');
    const placeholder = getAttr('placeholder');
    const title = getAttr('title');
    const alt = getAttr('alt');

    const text = inner
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const name = ariaLabel || alt || placeholder || title || text;
    if (!name) return undefined;

    let roleLabel: string;
    if (tag === 'button' || (tag === 'input' && /button|submit|reset/i.test(getAttr('type') || ''))) {
      roleLabel = 'Tlačítko';
    } else if (tag === 'a') {
      roleLabel = 'Odkaz';
    } else if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      roleLabel = 'Formulářové pole';
    } else {
      roleLabel = 'Prvek';
    }

    return `${roleLabel} "${name}"`;
  }
}