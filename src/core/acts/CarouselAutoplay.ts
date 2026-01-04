import { Page, ElementHandle } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface CarouselActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

export const CAROUSEL_ACT_RULE_ID = '2eb176'; // Carousel user interface component
export const CAROUSEL_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${CAROUSEL_ACT_RULE_ID}/`;

/**
 * Custom ACT-like test pro detekci automaticky rotujících karuselů bez možnosti zastavení.
 * 
 * Logika:
 * 1. Najde potenciální karusely (role="region" + aria-roledescription="carousel" nebo třídy .carousel/.slider).
 * 2. Zkontroluje, zda obsahují tlačítko pro zastavení (text/label "pause", "stop").
 * 3. Pokud tlačítko chybí, sleduje element po dobu 4 sekund.
 * 4. Pokud se obsah elementu změní (auto-rotace) a není možnost zastavení -> Violation.
 */
export async function runCarouselActTest(page: Page, pageUrl: string): Promise<CarouselActResult | null> {
  // 1. Najít kandidáty
  // Hledáme elementy, které vypadají jako karusely
  const candidates = await page.$$('[role="region"][aria-roledescription="carousel"], .carousel, .slider, [class*="carousel"], [class*="slider"]');

  if (candidates.length === 0) return null;

  const suspects: ElementHandle[] = [];

  for (const candidate of candidates) {
    // Ignorujeme elementy, které jsou skryté
    const isVisible = await candidate.evaluate((el: any) => {
        const win = (globalThis as any).window;
        const style = win.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
    });
    if (!isVisible) continue;

    // Zkontrolovat existenci Pause/Stop tlačítka uvnitř
    const hasPause = await candidate.evaluate((el: any) => {
        const buttons = Array.from(el.querySelectorAll('button, [role="button"], a[role="button"]'));
        return buttons.some((btn: any) => {
            const text = (btn.textContent || '').toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            // Hledáme klíčová slova pro pauzu
            return text.includes('pause') || text.includes('stop') || text.includes('zastav') || 
                   label.includes('pause') || label.includes('stop') || label.includes('zastav');
        });
    });

    if (!hasPause) {
        suspects.push(candidate);
    }
  }

  if (suspects.length === 0) return null;

  // 2. Zkontrolovat auto-rotaci (změna obsahu v čase)
  // Uložíme si počáteční stav (innerHTML)
  const initialStates = await Promise.all(suspects.map(h => h.evaluate(el => el.innerHTML)));
  
  // Počkáme 4 sekundy (WCAG vyžaduje možnost zastavení pro pohyb > 5s, ale auto-rotace bývá rychlejší)
  // Pokud se to pohne do 4s, je to "automatické".
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  const finalStates = await Promise.all(suspects.map(h => h.evaluate(el => el.innerHTML)));
  
  const violations: AccessibilityViolation[] = [];
  
  for (let i = 0; i < suspects.length; i++) {
      // Jednoduchá detekce změny. Může to být false positive (např. lazy loading), 
      // ale pro "Autoplay" je změna DOMu silný signál.
      if (initialStates[i] !== finalStates[i]) {
          const selector = await suspects[i].evaluate(el => {
              if (el.id) return '#' + el.id;
              if (el.className && typeof el.className === 'string') {
                  return '.' + el.className.split(/\s+/).filter(Boolean).join('.');
              }
              return el.tagName.toLowerCase();
          });

          const htmlSnippet = await suspects[i].evaluate(el => el.outerHTML.slice(0, 250) + '...');

          violations.push({
            id: 'a11yflow-carousel-autoplay',
            title: 'Automaticky rotující karusel bez možnosti zastavení',
            description: 'Byl detekován karusel nebo slider, který se automaticky posouvá (mění obsah) a nebyl nalezen ovládací prvek pro zastavení (Pause/Stop).',
            impact: 'serious',
            helpUrl: CAROUSEL_ACT_RULE_URL,
            count: 1,
            suggestedFix: 'Přidejte viditelné tlačítko "Pause" nebo "Stop", které umožní uživateli zastavit automatickou rotaci.',
            actRuleIds: [CAROUSEL_ACT_RULE_ID],
            actRuleUrls: [CAROUSEL_ACT_RULE_URL],
            nodes: [{ 
                html: htmlSnippet, 
                target: [selector],
                failureSummary: 'Element se automaticky mění v čase a chybí tlačítko pro zastavení.'
            }]
          });
      }
  }

  if (violations.length === 0) return null;

  const actionItems: HumanReadableActionItem[] = violations.map(v => ({
    id: v.id,
    impact: v.impact,
    priority: '🟠 Serious',
    category: 'Graphics',
    what: 'Karusel na stránce se automaticky posouvá, což může rušit uživatele při čtení nebo navigaci.',
    fix: 'Implementujte tlačítko pro zastavení rotace nebo rotaci ve výchozím stavu vypněte.',
    exampleUrl: pageUrl,
    wcagReference: '2.2.2 Pauza, zastavení, skrytí',
    actRuleIds: [CAROUSEL_ACT_RULE_ID],
    actRuleUrls: [CAROUSEL_ACT_RULE_URL],
  }));

  return { violations, actionItems };
}
