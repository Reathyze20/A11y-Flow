import { Page, ElementHandle } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface AutoplayMediaActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

export const AUTOPLAY_MEDIA_ACT_RULE_ID = '80f0bf';
export const AUTOPLAY_MEDIA_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${AUTOPLAY_MEDIA_ACT_RULE_ID}/`;

/**
 * Custom ACT-like test pro detekci automaticky hrajícího audia/videa.
 * 
 * Logika:
 * 1. Najde všechny <audio> a <video> elementy.
 * 2. Zkontroluje, zda mají atribut `autoplay`.
 * 3. Ověří, zda skutečně hrají (currentTime > 0, !paused, !ended) a zda nejsou ztlumené (!muted).
 * 4. Pokud hrají déle než 3 sekundy, je to violation (pokud neexistuje mechanismus pro zastavení, což těžko ověříme automaticky, takže reportujeme jako warning/violation).
 */
export async function runAutoplayMediaActTest(page: Page, pageUrl: string): Promise<AutoplayMediaActResult | null> {
  // Počkáme chvíli, aby se autoplay stihl projevit (pokud je scriptem)
  // Ale ne moc dlouho, abychom nezdržovali scan. 
  // WCAG limit je 3 sekundy.
  
  const mediaElements = await page.$$('audio, video');
  if (mediaElements.length === 0) return null;

  const violations: AccessibilityViolation[] = [];

  for (const element of mediaElements) {
    const state = await element.evaluate((el: any) => {
      return {
        tagName: el.tagName.toLowerCase(),
        autoplay: el.autoplay,
        paused: el.paused,
        muted: el.muted,
        currentTime: el.currentTime,
        duration: el.duration,
        src: el.currentSrc,
        controls: el.controls
      };
    });

    // Pokud je video ztlumené, je to OK (pro tento test, který řeší rušivé audio)
    if (state.muted) continue;

    // Pokud má element autoplay, ale currentTime je 0, počkáme chvíli, zda se nerozjede.
    // Někdy trvá, než se médium načte a začne hrát.
    if (state.autoplay && state.currentTime === 0) {
        await new Promise(r => setTimeout(r, 2000));
    }

    // Znovu načteme stav po případném čekání
    const currentState = await element.evaluate((el: any) => ({
        paused: el.paused,
        muted: el.muted,
        currentTime: el.currentTime
    }));

    if (!currentState.paused && !currentState.muted && currentState.currentTime > 0) {
      // Pokud hraje, počkáme, jestli přesáhne 3 sekundy
      if (currentState.currentTime < 3) {
         await new Promise(r => setTimeout(r, 3500));
      }
      
      const isStillPlaying = await element.evaluate((el: any) => !el.paused && !el.muted && el.currentTime > 3);

      if (isStillPlaying) {
        const htmlSnippet = await element.evaluate(el => el.outerHTML.slice(0, 250) + '...');
        const selector = await element.evaluate(el => {
            if (el.id) return '#' + el.id;
            if (el.className) return '.' + el.className.split(/\s+/).join('.');
            return el.tagName.toLowerCase();
        });

        violations.push({
          id: 'a11yflow-autoplay-media',
          title: 'Audio nebo video se spouští automaticky',
          description: 'Byl detekován mediální prvek, který automaticky přehrává zvuk po dobu delší než 3 sekundy. To může rušit uživatele čteček obrazovky.',
          impact: 'critical',
          helpUrl: AUTOPLAY_MEDIA_ACT_RULE_URL,
          count: 1,
          suggestedFix: 'Odstraňte atribut autoplay, nebo zajistěte, aby bylo video/audio ve výchozím stavu ztlumené (muted).',
          actRuleIds: [AUTOPLAY_MEDIA_ACT_RULE_ID],
          actRuleUrls: [AUTOPLAY_MEDIA_ACT_RULE_URL],
          nodes: [{
            html: htmlSnippet,
            target: [selector],
            failureSummary: `Element <${state.tagName}> hraje automaticky a není ztlumený.`
          }]
        });
      }
    }
  }

  if (violations.length === 0) return null;

  const actionItems: HumanReadableActionItem[] = violations.map(v => ({
    id: v.id,
    impact: 'critical',
    priority: '🔴 Critical',
    category: 'Content', // Nebo 'Grafika', ale audio ruší čtení textu
    what: 'Zvuk se spouští automaticky bez interakce uživatele.',
    fix: 'Vypněte autoplay nebo nastavte video jako ztlumené (muted).',
    exampleUrl: pageUrl,
    wcagReference: '1.4.2 Ovládání zvuku',
    actRuleIds: [AUTOPLAY_MEDIA_ACT_RULE_ID],
    actRuleUrls: [AUTOPLAY_MEDIA_ACT_RULE_URL],
  }));

  return { violations, actionItems };
}
