import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface ModalFocusActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

// Pro tento custom test zatím neexistuje oficiální ACT Rule ID,
// proto ho do reportu nepropagujeme jako ACT pravidlo.

/**
 * Skeleton pro ACT-like test správného focus managementu u modálních dialogů:
 * - po otevření modalu se focus přesune dovnitř,
 * - Tab/Shift+Tab cyklí focus uvnitř modalu,
 * - Esc nebo tlačítko Zavřít vrátí focus zpět na prvek, který modal otevřel.
 */
export async function runModalFocusActTest(page: Page, pageUrl: string): Promise<ModalFocusActResult | null> {
  const impact: ImpactLevel = 'serious';

  const info = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) {
      return { problems: [] };
    }

    const makeSelector = (el: any): string => {
      if (!el) return '';
      const tag = (el.tagName || 'div').toLowerCase();
      if (el.id) return `${tag}#${el.id}`;
      if (el.className && typeof el.className === 'string') {
        const cls = el.className
          .split(/\s+/)
          .filter(Boolean)
          .map((c: string) => `.${c}`)
          .join('');
        if (cls) return `${tag}${cls}`;
      }
      return tag;
    };

    const dialogs = Array.from(
      d.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'),
    ) as any[];

    const problems: any[] = [];

    for (const el of dialogs) {
      const selector = makeSelector(el);

      let htmlSnippet = '';
      try {
        const outer = (el as any).outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      const ariaModal = (el.getAttribute && el.getAttribute('aria-modal')) || '';
      const hasAriaModalTrue = String(ariaModal).toLowerCase() === 'true';

      const focusableSelector =
        'a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])';
      const focusableInside = el.querySelectorAll(focusableSelector);
      const hasFocusable = focusableInside && focusableInside.length > 0;

      const closeSelector =
        '[data-dismiss="modal"], .modal-close, .close, button[aria-label*="zavř" i], button[aria-label*="close" i]';
      let closeButton = el.querySelector(closeSelector as any);

      if (!closeButton) {
          // Fallback: check for buttons with text "Close" or "Zavřít"
          const buttons = Array.from(el.querySelectorAll('button')) as any[];
          closeButton = buttons.find((b: any) => {
              const t = (b.textContent || '').trim().toLowerCase();
              return t === 'close' || t === 'zavřít' || t === 'x';
          });
      }

      const hasClose = !!closeButton;

      const heading =
        (el.querySelector('h1, h2, h3, [role="heading"]') as any) ||
        (el.getAttribute && el.getAttribute('aria-label')) ||
        '';
      let labelText = '';
      if (typeof heading === 'string') {
        labelText = heading;
      } else if (heading && heading.textContent) {
        labelText = heading.textContent;
      }
      labelText = (labelText || '').trim();

      const issues: string[] = [];
      if (!hasAriaModalTrue) issues.push('aria-modal chybí nebo není "true"');
      if (!hasFocusable) issues.push('uvnitř dialogu nejsou fokusovatelné prvky');
      if (!hasClose) issues.push('chybí zřetelný tlačítko/tlačítko pro zavření');

      if (issues.length > 0) {
        problems.push({
          selector,
          htmlSnippet,
          labelText,
          issues,
        });
      }
    }

    return { problems };
  });

  if (!Array.isArray(info.problems) || info.problems.length === 0) {
    return null;
  }

  const violationNodes = info.problems.map((p: any) => ({
    html: p.htmlSnippet || '',
    target: p.selector ? [p.selector] : [],
    failureSummary:
      'Modální dialog má strukturální problém: ' + (Array.isArray(p.issues) ? p.issues.join(', ') : ''),
  }));

  const violation: AccessibilityViolation = {
    id: 'a11yflow-modal-focus',
    title: 'Nesprávný focus / struktura v modálním dialogu',
    description:
      'Na stránce byly zjištěny modální dialogy, které nemají správně nastavené aria-modal, fokusovatelné ovládací prvky nebo tlačítko pro zavření.',
    impact,
    helpUrl: undefined,
    count: violationNodes.length,
    suggestedFix:
      'Ujistěte se, že každý dialog má aria-modal="true", obsahuje fokusovatelné ovládací prvky a má zřetelný prvek pro zavření (tlačítko). Implementujte také focus trap uvnitř modalu a po jeho zavření vraťte focus na spouštěcí prvek.',
    nodes: violationNodes,
  };

  const firstProblem = info.problems[0];
  const exampleTarget = firstProblem && firstProblem.selector ? String(firstProblem.selector) : undefined;
  const labelText = firstProblem && firstProblem.labelText ? String(firstProblem.labelText) : '';

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟠 Serious',
    category: 'Navigation',
    what:
      'Modální dialog(y) nemají správně nastavenou strukturu nebo atributy pro přístupné ovládání z klávesnice (aria-modal, focusovatelné prvky, tlačítko Zavřít).',
    fix: 'Přesměrujte focus dovnitř dialogu po otevření, cyklujte ho uvnitř a po zavření ho vraťte na tlačítko, které modal otevřelo. Dialog označte role="dialog"/"alertdialog" a aria-modal="true".',
    exampleUrl: pageUrl,
    exampleTarget,
    elementLabel: labelText ? `Modální dialog "${labelText}"` : 'Modální dialog',
    wcagReference: '2.4.3 Pořadí focusu',
  };

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}
