import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface LandmarksActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

// TODO: nahraď ACT_RULE_ID skutečným ID z oficiálního W3C ACT Rules registry
export const LANDMARKS_ACT_RULE_ID = 'act-landmarks-placeholder';
export const LANDMARKS_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${LANDMARKS_ACT_RULE_ID}/`;

/**
 * Skeleton pro ACT-like test hlavních oblastí stránky (landmark regions):
 * - existence hlavního obsahu (role="main" / <main>)
 * - existence navigace (role="navigation")
 * - přiměřené použití role="banner"/"contentinfo" atd.
 *
 * Strategii je vhodné zhruba sladit s příslušným ACT pravidlem
 * (např. "HTML page has main landmark" a souvisejícími), ale detaily
 * nechat na implementaci.
 */
export async function runLandmarksActTest(page: Page, pageUrl: string): Promise<LandmarksActResult | null> {
  const impact: ImpactLevel = 'moderate';

  const info = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) return { problems: [] };

    const problems: string[] = [];
    const mains = d.querySelectorAll('main, [role="main"]');
    
    // Check 1: Exactly one main landmark
    if (mains.length === 0) {
      problems.push('Stránka nemá žádný hlavní obsah (<main> nebo role="main").');
    } else if (mains.length > 1) {
      let visibleMains = 0;
      mains.forEach((m: any) => {
         // Simple visibility check
         const win = (globalThis as any).window;
         const style = win.getComputedStyle(m);
         if (style.display !== 'none' && style.visibility !== 'hidden' && m.getAttribute('aria-hidden') !== 'true') {
             visibleMains++;
         }
      });
      if (visibleMains > 1) {
          problems.push(`Stránka má více než jeden viditelný hlavní obsah (${visibleMains}).`);
      }
    }

    return { problems };
  });

  if (info.problems.length === 0) {
    return null;
  }

  const violation: AccessibilityViolation = {
    id: 'a11yflow-landmarks',
    title: 'Nesprávně definované strukturální oblasti stránky (landmarks)',
    description: info.problems.join(' '),
    impact,
    helpUrl: LANDMARKS_ACT_RULE_URL,
    count: info.problems.length,
    suggestedFix: 'Zajistěte, aby stránka měla právě jeden viditelný element <main> nebo role="main".',
    actRuleIds: [LANDMARKS_ACT_RULE_ID],
    actRuleUrls: [LANDMARKS_ACT_RULE_URL],
    nodes: [],
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟡 Moderate',
    category: 'Structure',
    what: 'Struktura stránky není jasně vyznačená.',
    fix: 'Upravte landmark role.',
    exampleUrl: pageUrl,
    wcagReference: '1.3.1 Informace a vztahy',
    actRuleIds: [LANDMARKS_ACT_RULE_ID],
    actRuleUrls: [LANDMARKS_ACT_RULE_URL],
  };

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}
