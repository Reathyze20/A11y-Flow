import { Page } from 'puppeteer-core';
import { AccessibilityViolation, ImpactLevel, HumanReadableActionItem } from '../types';

/**
 * Custom ACT-like test pro ověření, že se fokus při procházení stránky
 * klávesou Tab nezasekne (keyboard trap / focus loop).
 *
 * Cíl: aproximovat ACT pravidla zaměřená na klávesnicovou past a fokus,
 * např. ACT Rule "b4f0c3" (Button has accessible name) rozšiřujeme
 * o čistě behaviorální scénář.
 */

export interface FocusOrderActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

const ACT_RULE_ID = 'b4f0c3';
const ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${ACT_RULE_ID}/`;

export async function runFocusOrderActTest(page: Page, pageUrl: string): Promise<FocusOrderActResult | null> {
  const maxSteps = 50;
  const visitedSelectors = new Map<string, number>();
  let detectedLoop = false;
  let lastSelector: string | null = null;
  let lastHtmlSnippet: string | undefined;

  // Pokud stránka nemá žádné fokusovatelné prvky, necháváme tuto logiku na
  // existujícím KeyboardNavigationReport – tady se zaměřujeme čistě na pasti.

  for (let step = 1; step <= maxSteps; step++) {
    await page.keyboard.press('Tab');
    // Krátká pauza mezi jednotlivými kroky – používáme generic timeout,
    // aby byl kód kompatibilní s typy Puppeteer Page v tomto projektu.
    await new Promise((resolve) => setTimeout(resolve, 35));

    const info = await page.evaluate(() => {
      const d = (globalThis as any).document as any;
      const active = (d && d.activeElement) || null;
      if (!active) return { hasActive: false };

      const rect = active.getBoundingClientRect();
      const selectorPieces: string[] = [];
      if (active.id) selectorPieces.push(`#${active.id}`);
      if (active.className && typeof active.className === 'string') {
        const cls = active.className
          .split(/\s+/)
          .filter(Boolean)
          .map((c: string) => `.${c}`)
          .join('');
        if (cls) selectorPieces.push(cls);
      }

      const selector =
        selectorPieces.length > 0
          ? `${active.tagName.toLowerCase()}${selectorPieces.join('')}`
          : active.tagName.toLowerCase();

      let htmlSnippet = '';
      try {
        const outer = (active as any).outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      return {
        hasActive: true,
        selector,
        htmlSnippet,
      };
    });

    if (!info.hasActive) {
      // Aktivní prvek úplně zmizel – potenciální klávesnicová past
      lastSelector = 'document';
      lastHtmlSnippet = undefined;
      detectedLoop = true;
      break;
    }

    const selector = info.selector || 'unknown';

    if (visitedSelectors.has(selector)) {
      const firstStep = visitedSelectors.get(selector)!;
      if (step - firstStep < 10) {
        // Rychlé cyklení mezi několika prvky – indikace keyboard trap
        detectedLoop = true;
        lastSelector = selector;
        lastHtmlSnippet = info.htmlSnippet;
        break;
      }
    } else {
      visitedSelectors.set(selector, step);
    }
  }

  if (!detectedLoop) {
    return null;
  }

  const impact: ImpactLevel = 'serious';

  const violation: AccessibilityViolation = {
    id: 'a11yflow-focus-trap',
    title: 'Klávesnicová past (focus se zacyklí nebo ztratí)',
    description:
      'Při procházení stránky klávesou Tab se fokus zacyklí mezi několika prvky nebo se úplně ztratí. Uživatel klávesnice ani nevidomý zákazník se čtečkou obrazovky se z pasti nedostanou bez použití myši.',
    impact,
    helpUrl: ACT_RULE_URL,
    count: 1,
    suggestedFix:
      'Zkontrolujte pořadí focusu, tabindex a chování modálních oken. Ujistěte se, že fokus nemůže uvíznout v omezené oblasti a že se po zavření modalu vrátí na logický prvek.',
    actRuleIds: [ACT_RULE_ID],
    actRuleUrls: [ACT_RULE_URL],
    nodes: [
      {
        html: lastHtmlSnippet || '',
        target: lastSelector ? [lastSelector] : [],
        failureSummary:
          'Fokus se během simulace klávesnice zacyklil nebo ztratil, což je v rozporu s požadavkem, aby stránka byla plně ovladatelná z klávesnice.',
      },
    ],
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟠 Vysoká',
    category: 'Navigace',
    what:
      'Při ovládání stránky z klávesnice (Tab/Shift+Tab) může fokus uvíznout v pasti nebo se zcela ztratit.',
    fix:
      'Uspořádejte fokusovatelné prvky tak, aby šel fokus lineárně dopředu i zpět bez cyklení. U modálních oken zajistěte, aby šlo fokus vrátit zpět na předchozí prvek a aby se uživatel dostal z popupu bez použití myši.',
    exampleUrl: pageUrl,
    exampleTarget: violation.nodes[0]?.target?.[0],
    wcagReference: '2.1.2 No Keyboard Trap',
    actRuleIds: [ACT_RULE_ID],
    actRuleUrls: [ACT_RULE_URL],
  };

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}
