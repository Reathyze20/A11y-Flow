import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface MetaViewportActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

export const META_VIEWPORT_ACT_RULE_ID = 'b4f0c3';
export const META_VIEWPORT_ACT_RULE_URL = `https://www.w3.org/WAI/standards-guidelines/act/rules/${META_VIEWPORT_ACT_RULE_ID}/`;

/**
 * Custom ACT-like test pro ověření, že meta viewport nezakazuje zoomování.
 * 
 * Logika:
 * 1. Najde tag <meta name="viewport">.
 * 2. Parsuje atribut content.
 * 3. Hledá 'user-scalable=no' nebo 'user-scalable=0'.
 * 4. Hledá 'maximum-scale' s hodnotou menší než 2.
 */
export async function runMetaViewportActTest(page: Page, pageUrl: string): Promise<MetaViewportActResult | null> {
  const viewportMeta = await page.$('meta[name="viewport"]');
  
  if (!viewportMeta) {
    // Pokud meta viewport chybí, je to obvykle v pořádku (prohlížeče zoomují defaultně),
    // nebo to řeší jiné pravidlo. Zde řešíme explicitní zákaz.
    return null;
  }

  const content = await viewportMeta.evaluate(el => el.getAttribute('content') || '');
  const lowerContent = content.toLowerCase();

  // Parsování content stringu (např. "width=device-width, initial-scale=1, user-scalable=no")
  const properties = lowerContent.split(',').map((p: string) => p.trim());
  
  let preventsZoom = false;
  let reason = '';

  for (const prop of properties) {
    const [key, value] = prop.split('=').map((s: string) => s.trim());
    
    if (key === 'user-scalable') {
      if (value === 'no' || value === '0') {
        preventsZoom = true;
        reason = 'user-scalable=no';
        break;
      }
    }
    
    if (key === 'maximum-scale') {
      const scale = parseFloat(value);
      if (!isNaN(scale) && scale < 2) {
        preventsZoom = true;
        reason = `maximum-scale=${scale}`;
        break;
      }
    }
  }

  if (!preventsZoom) return null;

  const htmlSnippet = await viewportMeta.evaluate(el => el.outerHTML);

  const violation: AccessibilityViolation = {
    id: 'a11yflow-meta-viewport',
    title: 'Meta viewport zakazuje zoomování',
    description: 'Stránka obsahuje meta tag viewport, který explicitně zakazuje uživateli přibližovat obsah (zoom), což je kritické pro slabozraké uživatele.',
    impact: 'critical',
    helpUrl: META_VIEWPORT_ACT_RULE_URL,
    count: 1,
    suggestedFix: 'Odstraňte "user-scalable=no" a zajistěte, aby "maximum-scale" bylo alespoň 2 (nebo tento atribut úplně odstraňte).',
    actRuleIds: [META_VIEWPORT_ACT_RULE_ID],
    actRuleUrls: [META_VIEWPORT_ACT_RULE_URL],
    nodes: [{
      html: htmlSnippet,
      target: ['meta[name="viewport"]'],
      failureSummary: `Meta viewport obsahuje nastavení '${reason}', které brání zoomování.`
    }]
  };

  const actionItem: HumanReadableActionItem = {
    id: violation.id,
    impact: 'critical',
    priority: '🔴 Critical',
    category: 'Technical',
    what: 'Stránku nelze na mobilních zařízeních přibližovat (zoomovat).',
    fix: 'Povolte zoomování odstraněním zákazu v meta tagu viewport.',
    exampleUrl: pageUrl,
    wcagReference: '1.4.4 Změna velikosti textu',
    actRuleIds: [META_VIEWPORT_ACT_RULE_ID],
    actRuleUrls: [META_VIEWPORT_ACT_RULE_URL],
  };

  return {
    violations: [violation],
    actionItems: [actionItem]
  };
}
