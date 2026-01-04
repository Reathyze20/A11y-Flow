import { Page } from 'puppeteer-core';
import { AccessibilityViolation, ImpactLevel, HumanReadableActionItem } from '../types';

/**
 * Custom ACT-like test pro ověření klávesnicové navigace a focus order.
 *
 * Primárně testuje WCAG 2.1.2 (No Keyboard Trap) - uživatel nesmí uvíznout
 * Částečně pokrývá WCAG 2.4.3 (Focus Order) - pořadí musí dávat smysl
 * 
 * Implementuje analýzu:
 * 1. Identifikace cílů (pomocí nativního Tab v browseru)
 * 2. Sekvenční pořadí (Tab Order Heuristic browseru)
 * 3. Diagnostika:
 *    - Keyboard Traps (smyčky) - WCAG 2.1.2
 *    - Visual Continuity (hrubé skoky v pořadí) - částečně WCAG 2.4.3
 *    - Modal Focus Bleed (únik z modálu) - WCAG 2.1.2 + best practices
 * 
 * POZNÁMKA: Plné pokrytí WCAG 2.4.3 vyžaduje sémantickou analýzu významu
 * a vztahů mezi prvky, což je náročné automatizovat. Tento test detekuje
 * pouze nejzávažnější porušení focus order pomocí heuristik.
 */

export interface FocusOrderActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
  pageDimensions?: { width: number; height: number };
}

// Primárně testujeme WCAG 2.1.2 (No Keyboard Trap)
// ACT Rule b4f0c3 - Focus order is meaningful (WCAG 2.4.3)
// Note: Plné pokrytí 2.4.3 není možné automaticky - vyžaduje chápání kontextu
const WCAG_SC_FOCUS_ORDER = '2.4.3';
const WCAG_SC_NO_TRAP = '2.1.2';
const ACT_RULE_ID = 'b4f0c3';
const ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${ACT_RULE_ID}/`;
const WCAG_FOCUS_ORDER_URL = 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html';
const WCAG_NO_TRAP_URL = 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html';

export async function runFocusOrderActTest(page: Page, pageUrl: string): Promise<FocusOrderActResult | null> {
  const maxSteps = 200;
  const visitedSelectors = new Map<string, number>();
  const violations: AccessibilityViolation[] = [];
  const actionItems: HumanReadableActionItem[] = [];

  let lastRect: { top: number; bottom: number; left: number; right: number } | null = null;
  let detectedLoop = false;

  // Reset focus na začátek (body), abychom začali čistý průchod
  await page.evaluate(() => {
    const d = (globalThis as any).document;
    const w = (globalThis as any).window;

    if (d.activeElement && typeof d.activeElement.blur === 'function') {
      d.activeElement.blur();
    }
    
    // Force focus to body by making it focusable temporarily
    // This ensures the browser's internal tab index pointer resets to the top
    const body = d.body;
    if (body) {
        const originalTabIndex = body.getAttribute('tabindex');
        body.setAttribute('tabindex', '-1');
        body.focus({ preventScroll: true });
        
        // We remove it immediately so it doesn't affect the test
        // But we keep the focus on it
        if (originalTabIndex === null) {
            body.removeAttribute('tabindex');
        } else {
            body.setAttribute('tabindex', originalTabIndex);
        }
    }
    
    w.scrollTo(0, 0);
  });

  // Ensure we start from the top by clicking top-left (safe reset for some browsers)
  try {
      await page.mouse.click(1, 1);
  } catch (e) {
      // Ignore if click fails
  }

  for (let step = 1; step <= maxSteps; step++) {
    await page.keyboard.press('Tab');
    // Krátká pauza pro stabilizaci UI
    await new Promise((resolve) => setTimeout(resolve, 35));

    const info = await page.evaluate(() => {
      const d = (globalThis as any).document;
      const w = (globalThis as any).window;
      
      // --- Shadow DOM Traversal for Active Element ---
      const getDeepActiveElement = (root: any = d): any => {
          let active = root.activeElement;
          while (active && active.shadowRoot && active.shadowRoot.activeElement) {
              active = active.shadowRoot.activeElement;
          }
          return active;
      };
      
      const active = getDeepActiveElement(d);
      
      // Pokud není aktivní prvek nebo je to body, považujeme to za "žádný specifický focus"
      if (!active || active === d.body) return { hasActive: false };

      const rect = active.getBoundingClientRect();
      const scrollX = w.scrollX || w.pageXOffset;
      const scrollY = w.scrollY || w.pageYOffset;
      
      // Sestavení unikátního selektoru
      const getUniqueSelector = (el: any) => {
          if (!el || el.nodeType !== 1) return '';
          if (el.id) return '#' + el.id;
          
          const path: string[] = [];
          let current = el;
          
          while (current && current.nodeType === 1) {
              let selector = current.tagName.toLowerCase();
              if (current.id) {
                  selector = '#' + current.id;
                  path.unshift(selector);
                  break; 
              } else {
                  let sibling = current;
                  let nth = 1;
                  while (sibling = sibling.previousElementSibling) {
                      if (sibling.tagName === current.tagName) nth++;
                  }
                  if (nth > 1) selector += `:nth-of-type(${nth})`;
              }
              path.unshift(selector);
              current = current.parentNode;
          }
          return path.join(' > ');
      };

      const selector = getUniqueSelector(active);

      let htmlSnippet = '';
      try {
        const outer = active.outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch { htmlSnippet = ''; }

      // Detekce modálních oken (Phase 3B)
      // Hledáme viditelný element s aria-modal="true"
      const modals = Array.from(d.querySelectorAll('[aria-modal="true"]')) as any[];
      const openModal = modals.find((m: any) => {
          const style = w.getComputedStyle(m);
          return style.display !== 'none' && style.visibility !== 'hidden' && !m.hasAttribute('inert');
      });
      
      const isInsideModal = openModal ? openModal.contains(active) : false;
      const modalSelector = openModal ? (openModal.id ? `#${openModal.id}` : openModal.tagName) : null;

      return {
        hasActive: true,
        selector,
        htmlSnippet,
        rect: { 
            top: rect.top + scrollY, 
            bottom: rect.bottom + scrollY, 
            left: rect.left + scrollX, 
            right: rect.right + scrollX, 
            width: rect.width, 
            height: rect.height 
        },
        hasOpenModal: !!openModal,
        isInsideModal,
        modalSelector,
        viewportRect: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        }
      };
    });

    if (!info.hasActive) {
        // Focus se ztratil nebo jsme na konci (body)
        break;
    }

    const currentSelector = info.selector || 'unknown';
    const currentHtml = info.htmlSnippet || '';

    // --- 3. Fáze: Diagnostika ---

    // A. Detekce Keyboard Traps (Smyčky)
    if (visitedSelectors.has(currentSelector)) {
      const firstStep = visitedSelectors.get(currentSelector)!;
      const cycleLength = step - firstStep;
      
      // Heuristika pro "Safe Cycle" (Wrap Around):
      // Pokud se focus vrátil na začátek (malý cyklus), ale došlo k výraznému vizuálnímu skoku nahoru (např. z patičky do hlavičky),
      // považujeme to za přirozené cyklování stránky, nikoliv za past.
      const isJumpUp = lastRect && info.rect && (info.rect.top < lastRect.top - 50);
      const isSafeCycle = isJumpUp;

      if (!isSafeCycle && cycleLength < 10) {
        if (!detectedLoop) {
            detectedLoop = true;
            addViolation(
                violations, actionItems, pageUrl,
                'focus-trap',
                'Klávesnicová past (focus loop)',
                'critical',
                'Focus se zacyklil mezi prvky. Uživatel se nemůže dostat dál. Porušení WCAG 2.1.2 (No Keyboard Trap).',
                currentHtml,
                currentSelector,
                WCAG_SC_NO_TRAP,
                WCAG_NO_TRAP_URL
            );
        }
        break; // Ukončíme test, jsme v pasti
      }
    } else {
      visitedSelectors.set(currentSelector, step);
    }

    // B. Detekce vizuálních skoků (Visual Continuity)
    if (lastRect && info.rect) {
        const delta = 100; // Toleranční práh z analýzy
        // Pokud y_{i+1} < y_i - delta (skok nahoru)
        if (info.rect.top < lastRect.top - delta) {
             addViolation(
                 violations, actionItems, pageUrl,
                 'visual-focus-jump',
                 'Nečekaný vizuální skok fokusu',
                 'moderate',
                 `Focus skočil vizuálně nahoru o více než ${delta}px (z Y=${Math.round(lastRect.top)} na Y=${Math.round(info.rect.top)}). To může mást uživatele a indikuje nesoulad mezi DOM pořadím a vizuálním zobrazením. Možné porušení WCAG 2.4.3 (Focus Order).`,
                 currentHtml,
                 currentSelector,
                 WCAG_SC_FOCUS_ORDER,
                 WCAG_FOCUS_ORDER_URL
             );
        }
    }
    if (info.rect) {
        lastRect = info.rect;
    }

    // C. Modální pasti (Focus Bleed)
    if (info.hasOpenModal && !info.isInsideModal) {
        addViolation(
            violations, actionItems, pageUrl,
            'modal-focus-bleed',
            'Focus unikl z modálního okna',
            'critical',
            `Stránka má otevřené modální okno (${info.modalSelector}), ale focus se nachází mimo něj (${currentSelector}). Uživatelé čteček mohou bloudit po stránce pod modalem. Porušení WCAG 2.1.2 (No Keyboard Trap) a best practices pro modální dialogy.`,
            currentHtml,
            currentSelector,
            WCAG_SC_NO_TRAP,
            WCAG_NO_TRAP_URL
        );
    }
  }

  const pageDimensions = await page.evaluate(() => {
      const d = (globalThis as any).document;
      return {
          width: d.documentElement.scrollWidth,
          height: d.documentElement.scrollHeight
      };
  });

  if (violations.length === 0) {
    return {
        violations,
        actionItems,
        pageDimensions
    };
  }

  return {
    violations,
    actionItems,
    pageDimensions
  };
}

function addViolation(
    violations: AccessibilityViolation[],
    actionItems: HumanReadableActionItem[],
    pageUrl: string,
    idSuffix: string,
    title: string,
    impact: ImpactLevel,
    description: string,
    html: string,
    selector: string,
    wcagSC: string,
    wcagUrl: string
) {
    const fullId = `a11yflow-${idSuffix}`;
    
    // Zamezení duplicit pro stejný element a typ chyby
    if (violations.some(v => v.id === fullId && v.nodes[0].target[0] === selector)) {
        return;
    }

    // Vhodná oprava podle typu problému
    let suggestedFix = '';
    if (idSuffix === 'focus-trap') {
        suggestedFix = 'Opravte keyboard trap - zajistěte, že uživatel se může dostat pryč pomocí Tab/Shift+Tab nebo Escape. Pro modální dialogy použijte focus management s správným chytáním fokusu.';
    } else if (idSuffix === 'visual-focus-jump') {
        suggestedFix = 'Upravte pořadí prvků v DOM tak, aby odpovídalo vizuálnímu pořadí, nebo použijte CSS properties jako flexbox order opatrně. Zvažte také správné použití tabindex.';
    } else if (idSuffix === 'modal-focus-bleed') {
        suggestedFix = 'Implementujte správný focus management pro modální okna - při otevření přesuňte focus dovnitř, zamkněte focus trap v rámci modalu, při zavření vraťte focus zpět na původní element.';
    } else {
        suggestedFix = 'Upravte pořadí prvků v DOMu, tabindex nebo správu fokusu tak, aby zachovávalo logický význam a funkčnost.';
    }

    const violation: AccessibilityViolation = {
        id: fullId,
        title,
        description,
        impact,
        helpUrl: wcagUrl,
        count: 1,
        suggestedFix,
        actRuleIds: [ACT_RULE_ID],
        actRuleUrls: [ACT_RULE_URL],
        nodes: [{
            html: html || '',
            target: [selector],
            failureSummary: description
        }]
    };

    const actionItem: HumanReadableActionItem = {
        id: fullId,
        impact,
        priority: impact === 'critical' ? '🔴 Critical' : (impact === 'serious' ? '🟠 Serious' : '🟡 Moderate'),
        category: 'Navigation',
        what: title,
        fix: suggestedFix,
        exampleUrl: pageUrl,
        exampleTarget: selector,
        wcagReference: wcagSC === WCAG_SC_NO_TRAP ? '2.1.2 No Keyboard Trap' : '2.4.3 Focus Order',
        actRuleIds: [ACT_RULE_ID],
        actRuleUrls: [ACT_RULE_URL]
    };

    violations.push(violation);
    actionItems.push(actionItem);
}
