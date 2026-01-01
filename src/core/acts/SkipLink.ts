import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface SkipLinkActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

// Pro tento custom test zatím neexistuje oficiální ACT Rule ID,
// proto ho do reportu nepropagujeme jako ACT pravidlo.

/**
 * Skeleton pro ACT-like test "skip link" (přeskočit na obsah):
 * - ověřit existenci odkazu / tlačítka, které umožní přeskočit repetitivní navigaci,
 * - zkontrolovat, že se prvek objeví při focusu (i když je výchozí stav skrytý),
 * - ověřit, že při aktivaci přesune focus na hlavní obsah.
 */
export async function runSkipLinkActTest(page: Page, pageUrl: string): Promise<SkipLinkActResult | null> {
  const impact: ImpactLevel = 'serious';

  const info = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) {
      return {
        hasSkipLink: false,
        problems: [],
        bodyHtmlSnippet: '',
      };
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

    const candidates: any[] = [];
    const elements = Array.from(d.querySelectorAll('a, button')) as any[];
    const textPatterns = [
      'skip to main',
      'skip to content',
      'skip main content',
      'skip navigation',
      'přeskočit na obsah',
      'přeskočit obsah',
      'přeskočit navigaci',
    ];

    for (const el of elements) {
      const text = (el.textContent || '').toLowerCase().trim();
      const ariaLabel = (el.getAttribute && el.getAttribute('aria-label')) || '';
      const label = ((ariaLabel as string) || text).toLowerCase();
      if (!label) continue;

      const matches = textPatterns.some((p) => label.includes(p));
      if (!matches) continue;

      const selector = makeSelector(el);

      let htmlSnippet = '';
      try {
        const outer = (el as any).outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      const href = (el.getAttribute && el.getAttribute('href')) || '';
      let hrefTargetId: string | null = null;
      let targetExists = false;
      let targetIsMainLike = false;
      let targetIsFocusable = false;
      if (href && typeof href === 'string' && href.startsWith('#') && href.length > 1) {
        hrefTargetId = href.slice(1);
        const target = d.getElementById(hrefTargetId);
        if (target) {
          targetExists = true;

          const tag = (target.tagName || '').toLowerCase();
          const role = (target.getAttribute && target.getAttribute('role')) || '';
          const id = (target.id || '').toLowerCase();
          const className = (target.className && typeof target.className === 'string')
            ? target.className.toLowerCase()
            : '';

          if (tag === 'main' || String(role).toLowerCase() === 'main') {
            targetIsMainLike = true;
          }
          if (/main|content|primary/.test(id) || /main|content|primary/.test(className)) {
            targetIsMainLike = true;
          }

          const focusableSelector =
            'a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]:not([tabindex="-1"])';
          if (target.matches && target.matches(focusableSelector)) {
            targetIsFocusable = true;
          }
        }
      }

      const nodeName = (el.tagName || '').toLowerCase();
      const isFocusable =
        (nodeName === 'a' && !!href) ||
        nodeName === 'button' ||
        (typeof el.tabIndex === 'number' && el.tabIndex >= 0);

      const textLabel = (ariaLabel || text || '').trim();

      candidates.push({
        selector,
        htmlSnippet,
        hrefTargetId,
        targetExists,
        targetIsMainLike,
        targetIsFocusable,
        isFocusable,
        textLabel,
      });
    }

    const hasSkipLink =
      candidates.length > 0 &&
      candidates.some(
        (c) =>
          c.isFocusable &&
          (!c.hrefTargetId || (c.targetExists && (c.targetIsMainLike || c.targetIsFocusable))),
      );

    const brokenCandidates = candidates.filter((c) => {
      if (!c.isFocusable) return true;
      if (c.hrefTargetId && !c.targetExists) return true;
      if (c.hrefTargetId && c.targetExists && !c.targetIsMainLike && !c.targetIsFocusable) {
        return true;
      }
      return false;
    });

    let bodyHtmlSnippet = '';
    try {
      const body = d.body as any;
      if (body && body.outerHTML) {
        const outer = String(body.outerHTML);
        bodyHtmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      }
    } catch {
      bodyHtmlSnippet = '';
    }

    return {
      hasSkipLink,
      problems: brokenCandidates,
      bodyHtmlSnippet,
    };
  });

  // Pokud máme aspoň jeden dobře fungující skip link, stránku považujeme za v pořádku.
  if (info.hasSkipLink) {
    return null;
  }

  const hasBrokenCandidates = Array.isArray(info.problems) && info.problems.length > 0;

  const violationNodes = hasBrokenCandidates
    ? info.problems.map((p: any) => ({
        html: p.htmlSnippet || '',
        target: p.selector ? [p.selector] : [],
        failureSummary:
          'Skip link existuje, ale není fokusovatelný z klávesnice nebo jeho cílový prvek neexistuje.',
      }))
    : [
        {
          html: info.bodyHtmlSnippet || '',
          target: ['body'],
          failureSummary:
            'Stránka neobsahuje žádný odkaz nebo tlačítko, které by umožnilo přeskočit opakující se navigaci na hlavní obsah.',
        },
      ];

  const violation: AccessibilityViolation = {
    id: 'a11yflow-skip-link',
    title: hasBrokenCandidates
      ? 'Nefunkční odkaz „Přeskočit na obsah“'
      : 'Chybějící odkaz „Přeskočit na obsah“',
    description:
      'Stránka nenabízí nebo správně neimplementuje odkaz/tlačítko pro přeskočení opakující se navigace a přechod k hlavnímu obsahu.',
    impact,
    helpUrl: undefined,
    count: violationNodes.length,
    suggestedFix:
      'Přidejte nebo opravte odkaz „Přeskočit na hlavní obsah“, který je fokusovatelný z klávesnice a při aktivaci přesune focus na hlavní obsah (např. role="main").',
    nodes: violationNodes,
  };

  const firstNode = violationNodes[0];
  const exampleTarget = firstNode && firstNode.target && firstNode.target[0] ? String(firstNode.target[0]) : undefined;

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact,
    priority: '🟠 Vysoká',
    category: 'Navigace',
    what: hasBrokenCandidates
      ? 'Odkaz „Přeskočit na obsah“ existuje, ale není správně fokusovatelný nebo jeho cíl neexistuje.'
      : 'Uživatelé klávesnice musejí při každém načtení stránky projít celou hlavičku a menu – chybí odkaz „Přeskočit na obsah“. ',
    fix: 'Implementujte viditelný „skip link“, který se objeví při focusu a při aktivaci přesune focus na hlavní obsah (např. role="main").',
    exampleUrl: pageUrl,
    exampleTarget,
    elementLabel: hasBrokenCandidates
      ? 'Odkaz „Přeskočit na obsah“'
      : 'Stránka (chybí odkaz „Přeskočit na obsah“)',
    wcagReference: '2.4.1 Bloky přeskočení',
  };

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}
