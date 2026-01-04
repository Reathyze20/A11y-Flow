export type ActCoverageStatus = 'axe' | 'custom' | 'manual' | 'partial';

export interface ActRuleDescriptor {
  id: string; // např. "b4f0c3"
  name: string; // lidský název pravidla
  wcag: string[]; // seznam WCAG kritérií, na která se pravidlo váže
  status: ActCoverageStatus; // jakým způsobem je v A11yFlow pokryto
  axeRuleIds?: string[]; // případné odpovídající axe-core rule IDs
  customTests?: string[]; // IDs testů z CustomActSuite (např. "focus-order")
  notes?: string;
}

/**
 * Registr známých ACT pravidel a toho, jak jsou v A11yFlow pokryta.
 * Zatím obsahuje jen podmnožinu pravidel, ale struktura umožňuje postupné
 * rozšiřování a výpočet coverage metrik.
 */
export const ActRuleRegistry: ActRuleDescriptor[] = [
  {
    id: 'b4f0c3',
    name: 'Button has accessible name',
    wcag: ['4.1.2'],
    status: 'axe',
    axeRuleIds: ['button-name'],
    notes: 'Pokryto pravidlem axe-core "button-name"; v reportu doplněno přes ActMapper.',
  },
  {
    id: 'skip-link-placeholder',
    name: 'Page has skip link to main content',
    wcag: ['2.4.1'],
    status: 'custom',
    customTests: ['skip-link'],
    notes: 'Pokrytí zajišťuje custom Puppeteer test runSkipLinkActTest.',
  },
  {
    id: 'modal-focus-placeholder',
    name: 'Modal dialog manages focus correctly',
    wcag: ['2.4.3', '2.1.2'],
    status: 'custom',
    customTests: ['modal-focus'],
    notes: 'Pokrytí zajišťuje custom Puppeteer test runModalFocusActTest.',
  },
  {
    id: 'keyboard-trap-placeholder',
    name: 'No keyboard trap in focus order',
    wcag: ['2.1.2'],
    status: 'custom',
    customTests: ['focus-order'],
    notes: 'Pokrytí zajišťuje custom Puppeteer test runFocusOrderActTest.',
  },
  {
    id: 'landmarks-placeholder',
    name: 'Page has appropriate landmarks',
    wcag: ['1.3.1'],
    status: 'custom',
    customTests: ['landmarks'],
    notes: 'Strukturální landmark role jsou ověřovány v testu runLandmarksActTest.',
  },
  {
    id: 'carousel-autoplay-placeholder',
    name: 'Auto-rotating content can be paused or stopped',
    wcag: ['2.2.2'],
    status: 'custom',
    customTests: ['carousel-autoplay'],
    notes: 'Detekci auto-rotace a ovládacích prvků řeší runCarouselActTest.',
  },
  {
    id: 'form-errors-placeholder',
    name: 'Form errors are identified and described',
    wcag: ['3.3.1', '3.3.3'],
    status: 'custom',
    customTests: ['form-errors'],
    notes: 'Chování chyb formuláře testuje runFormErrorsActTest s dynamickým submit testem.',
  },
  {
    id: 'suspicious-alt-placeholder',
    name: 'Image alt text is meaningful',
    wcag: ['1.1.1'],
    status: 'custom',
    customTests: ['suspicious-alt'],
    notes: 'Heuristická detekce nesmyslných alt textů (názvy souborů, placeholdery, redundantní fráze).',
  },
];

export function getActCoverageSummary(): {
  total: number;
  byStatus: Record<ActCoverageStatus, number>;
} {
  const byStatus: Record<ActCoverageStatus, number> = {
    axe: 0,
    custom: 0,
    manual: 0,
    partial: 0,
  };

  for (const rule of ActRuleRegistry) {
    byStatus[rule.status] += 1;
  }

  return {
    total: ActRuleRegistry.length,
    byStatus,
  };
}
