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
  // TODO: 1) Pomocí page.evaluate projít DOM a zjistit:
  //  - zda existuje právě jedna role="main" / <main>
  //  - zda je přítomna hlavní navigace (role="navigation")
  //  - zda se nepoužívá více banner/contentinfo landmarků v rozporu s doporučeními
  // 2) Pokud je vše v pořádku, vrať null
  // 3) Pokud najdeš porušení, postav jedno nebo více AccessibilityViolation
  //    s odpovídajícími actRuleIds/actRuleUrls a HumanReadableActionItem.

  const impact: ImpactLevel = 'moderate';

  // Placeholder – skutečnou logiku doplň později
  const hasIssues = false;
  if (!hasIssues) return null;

  const violation: AccessibilityViolation = {
    id: 'a11yflow-landmarks',
    title: 'Nesprávně definované strukturální oblasti stránky (landmarks)',
    description: 'Stránka nepoužívá doporučené landmark role (main, navigation, banner, contentinfo) nebo je používá v rozporu s očekáváním.',
    impact,
    helpUrl: LANDMARKS_ACT_RULE_URL,
    count: 1,
    suggestedFix: 'Přidejte a upravte landmark role tak, aby stránka měla jednoznačně označený hlavní obsah, navigaci a patičku.',
    actRuleIds: [LANDMARKS_ACT_RULE_ID],
    actRuleUrls: [LANDMARKS_ACT_RULE_URL],
    nodes: [],
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟡 Střední',
    category: 'Struktura',
    what: 'Struktura stránky není jasně vyznačená pomocí landmark rolí, což komplikuje orientaci uživatelům se čtečkou obrazovky.',
    fix: 'Označte hlavní obsah role="main" nebo prvkem <main>, navigaci role="navigation" a patičku role="contentinfo". Ujistěte se, že hlavní landmarky nejsou zbytečně duplikované.',
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
