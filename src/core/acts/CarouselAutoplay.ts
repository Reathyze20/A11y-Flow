import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface CarouselActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

export const CAROUSEL_ACT_RULE_ID = 'act-carousel-autoplay-placeholder';
export const CAROUSEL_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${CAROUSEL_ACT_RULE_ID}/`;

/**
 * Skeleton pro ACT-like test auto-rotačních karuselů:
 * - obsah se nesmí automaticky měnit bez možnosti pauzy/stop/hide,
 * - rychlost auto-rotace nesmí bránit čtení,
 * - uživatel musí mít z klávesnice dostupné ovládání (pause/next/prev).
 */
export async function runCarouselActTest(page: Page, pageUrl: string): Promise<CarouselActResult | null> {
  // TODO: Strategie
  // 1) Heuristicky detekovat karusely (data attributes, role="region" s rotujícími slidy, změny DOMu v čase).
  // 2) Pomocí page.evaluate a opakovaných snapshotů zjistit, zda se obsah mění automaticky.
  // 3) Vyhledat ovládací prvky (pause/stop/next/prev) a ověřit, že jsou dostupné z klávesnice.
  // 4) Pokud auto-rotace běží bez ovládání nebo příliš rychle, vytvořit violation.

  const impact: ImpactLevel = 'moderate';

  const hasIssues = false; // placeholder
  if (!hasIssues) return null;

  const violation: AccessibilityViolation = {
    id: 'a11yflow-carousel-autoplay',
    title: 'Automaticky rotující obsah bez možnosti pauzy',
    description: 'Karusel nebo slider se automaticky posouvá bez jasné možnosti pauzy nebo zastavení, což ztěžuje čtení obsahu a může vyvolávat nevolnost.',
    impact,
    helpUrl: CAROUSEL_ACT_RULE_URL,
    count: 1,
    suggestedFix: 'Přidejte ovládání karuselu (pauza/stop/next/prev) dostupné z klávesnice a vypněte auto-rotaci po interakci uživatele.',
    actRuleIds: [CAROUSEL_ACT_RULE_ID],
    actRuleUrls: [CAROUSEL_ACT_RULE_URL],
    nodes: [],
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟡 Střední',
    category: 'Grafika',
    what: 'Automaticky rotující karusel může být pro některé uživatele rušivý nebo nedostupný, pokud nejde zastavit nebo ovládat klávesnicí.',
    fix: 'Umožněte uživatelům rotaci zastavit a přidat ovládací prvky přístupné z klávesnice. Zvažte vypnutí auto-rotace úplně.',
    exampleUrl: pageUrl,
    wcagReference: '2.2.2 Pauza, zastavení, skrytí',
    actRuleIds: [CAROUSEL_ACT_RULE_ID],
    actRuleUrls: [CAROUSEL_ACT_RULE_URL],
  };

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}
