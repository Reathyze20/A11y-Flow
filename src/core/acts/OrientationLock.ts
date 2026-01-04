import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface OrientationLockActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

export const ORIENTATION_LOCK_ACT_RULE_ID = 'b33eff';
export const ORIENTATION_LOCK_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${ORIENTATION_LOCK_ACT_RULE_ID}/`;

/**
 * Custom ACT-like test pro detekci uzamčení orientace pomocí CSS transformací.
 * 
 * Logika:
 * 1. Změní viewport na Portrait (např. 375x812).
 * 2. Zkontroluje, zda `body` nebo hlavní wrapper nemá `transform: rotate(...)`.
 * 3. Změní viewport na Landscape (např. 812x375).
 * 4. Zkontroluje totéž.
 * 5. Pokud je detekována rotace (90deg / -90deg), znamená to, že stránka se snaží vynutit orientaci.
 */
export async function runOrientationLockActTest(page: Page, pageUrl: string): Promise<OrientationLockActResult | null> {
  const originalViewport = page.viewport();
  
  // Definice testovacích rozlišení
  const portrait = { width: 375, height: 812, isMobile: true, hasTouch: true };
  const landscape = { width: 812, height: 375, isMobile: true, hasTouch: true };

  let detectedLock = false;
  let lockReason = '';
  let lockOrientation = '';

  try {
    // Test Portrait
    await page.setViewport(portrait);
    // Krátká pauza pro aplikaci stylů/JS
    await new Promise(r => setTimeout(r, 100));
    const portraitRotation = await checkRotation(page);
    
    if (portraitRotation) {
      detectedLock = true;
      lockReason = `V režimu Portrait (na výšku) je obsah otočen o ${portraitRotation}.`;
      lockOrientation = 'Portrait';
    } else {
      // Test Landscape (jen pokud jsme nenašli problém v Portrait)
      await page.setViewport(landscape);
      await new Promise(r => setTimeout(r, 100));
      const landscapeRotation = await checkRotation(page);
      
      if (landscapeRotation) {
        detectedLock = true;
        lockReason = `V režimu Landscape (na šířku) je obsah otočen o ${landscapeRotation}.`;
        lockOrientation = 'Landscape';
      }
    }

  } finally {
    // Obnovit původní viewport
    if (originalViewport) {
      await page.setViewport(originalViewport);
    }
  }

  if (!detectedLock) return null;

  const violation: AccessibilityViolation = {
    id: 'a11yflow-orientation-lock',
    title: 'Stránka uzamyká orientaci pomocí CSS',
    description: 'Byla detekována CSS transformace (rotace), která pravděpodobně slouží k vynucení konkrétní orientace zařízení (např. "Otočte zařízení na šířku"). To brání uživatelům, kteří mají zařízení pevně uchycené (např. na vozíku), v používání stránky.',
    impact: 'serious',
    helpUrl: ORIENTATION_LOCK_ACT_RULE_URL,
    count: 1,
    suggestedFix: 'Odstraňte CSS transformace, které rotují celou stránku na základě orientace zařízení. Stránka by měla být responsivní a přizpůsobit se oběma orientacím.',
    actRuleIds: [ORIENTATION_LOCK_ACT_RULE_ID],
    actRuleUrls: [ORIENTATION_LOCK_ACT_RULE_URL],
    nodes: [{
      html: '<!-- Detected via computed style check on body/wrapper -->',
      target: ['body'],
      failureSummary: lockReason
    }]
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact: 'serious',
    priority: '🟠 Serious',
    category: 'Technical',
    what: 'Stránka nutí uživatele otočit zařízení (uzamyká orientaci).',
    fix: 'Zajistěte, aby obsah fungoval v orientaci na výšku i na šířku bez nutnosti otáčet zařízení.',
    exampleUrl: pageUrl,
    wcagReference: '1.3.4 Orientace',
    actRuleIds: [ORIENTATION_LOCK_ACT_RULE_ID],
    actRuleUrls: [ORIENTATION_LOCK_ACT_RULE_URL],
  };

  return {
    violations: [violation],
    actionItems: [actionItem]
  };
}

async function checkRotation(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const doc = (globalThis as any).document;
    const win = (globalThis as any).window;

    // Elementy, které se typicky používají pro rotaci celé stránky
    const candidates = [
        doc.body, 
        doc.documentElement, 
        doc.querySelector('#app'), 
        doc.querySelector('#root'), 
        doc.querySelector('main')
    ];
    
    for (const el of candidates) {
      if (!el) continue;
      
      const style = win.getComputedStyle(el);
      const transform = style.transform;
      
      // transform: matrix(...) nebo none
      if (transform && transform !== 'none') {
        // Jednoduchá detekce rotace 90 stupňů
        // matrix(0, 1, -1, 0, 0, 0) -> 90deg
        // matrix(0, -1, 1, 0, 0, 0) -> -90deg
        
        // Parsujeme matrix
        const values = transform.split('(')[1]?.split(')')[0]?.split(',');
        if (values && values.length >= 4) {
          const a = parseFloat(values[0]);
          const b = parseFloat(values[1]);
          // const c = parseFloat(values[2]);
          // const d = parseFloat(values[3]);
          
          // Vypočítat úhel
          const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
          
          if (Math.abs(angle) === 90) {
            return `${angle}deg`;
          }
        }
      }
      
      // Někdy se používá specifická třída s rotate
      if (el.classList.contains('rotate-90') || style.rotate === '90deg' || style.rotate === '-90deg') {
         return style.rotate || '90deg';
      }
    }
    return null;
  });
}
