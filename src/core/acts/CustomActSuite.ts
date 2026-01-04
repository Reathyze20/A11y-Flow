import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem } from '../types';
import { runFocusOrderActTest } from './FocusOrder';
import { runLandmarksActTest } from './Landmarks';
import { runSkipLinkActTest } from './SkipLink';
import { runModalFocusActTest } from './ModalFocus';
import { runCarouselActTest } from './CarouselAutoplay';
import { runMetaViewportActTest } from './MetaViewport';
import { runOrientationLockActTest } from './OrientationLock';
import { runAutoplayMediaActTest } from './AutoplayMedia';
import { runFormErrorsActTest } from './FormErrors';
import { runSuspiciousAltTextTest } from './SuspiciousAltText';

export interface CustomActSuiteResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
  pageDimensions?: { width: number; height: number };
}

export interface CustomActSuiteOptions {
  enabledTests?: string[]; // IDs testů, které se mají spustit (pokud není, použije se default sada)
}

interface RegisteredActTest {
  id: string;
  label: string;
  // Funkce, která provede test a vrátí buď nálezy, nebo null, pokud je vše v pořádku
  run: (page: Page, url: string) => Promise<CustomActSuiteResult | null>;
  defaultEnabled: boolean;
}

const REGISTERED_TESTS: RegisteredActTest[] = [
  {
    id: 'focus-order',
    label: 'Keyboard focus order / traps',
    run: runFocusOrderActTest,
    defaultEnabled: true,
  },
  {
    id: 'landmarks',
    label: 'Page landmarks (main, navigation, contentinfo, banner)',
    run: runLandmarksActTest,
    defaultEnabled: true,
  },
  {
    id: 'skip-link',
    label: 'Skip to main content link',
    run: runSkipLinkActTest,
    defaultEnabled: true,
  },
  {
    id: 'modal-focus',
    label: 'Modal dialog focus management',
    run: runModalFocusActTest,
    defaultEnabled: true,
  },
  {
    id: 'carousel-autoplay',
    label: 'Auto-rotating carousels / sliders',
    run: runCarouselActTest,
    defaultEnabled: true,
  },
  {
    id: 'form-errors',
    label: 'Form error handling and announcements',
    run: runFormErrorsActTest,
    defaultEnabled: true,
  },
  {
    id: 'suspicious-alt',
    label: 'Suspicious or meaningless alt text detection',
    run: runSuspiciousAltTextTest,
    defaultEnabled: true,
  },
  {
    id: 'meta-viewport',
    label: 'Meta viewport zoom restrictions',
    run: runMetaViewportActTest,
    defaultEnabled: true,
  },
  {
    id: 'orientation-lock',
    label: 'Orientation lock (CSS transform)',
    run: runOrientationLockActTest,
    defaultEnabled: true,
  },
  {
    id: 'autoplay-media',
    label: 'Autoplay audio/video',
    run: runAutoplayMediaActTest,
    defaultEnabled: true,
  },
];

export async function runCustomActSuite(
  page: Page,
  url: string,
  options: CustomActSuiteOptions = {},
): Promise<CustomActSuiteResult> {
  const enabledTestIds = resolveEnabledTestIds(options);
  const { violations, actionItems, pageDimensions } = await runRegisteredTests(page, url, enabledTestIds);

  return {
    violations,
    actionItems,
    pageDimensions
  };
}

export function listCustomActTests(): { id: string; label: string }[] {
  return REGISTERED_TESTS.map((t) => ({ id: t.id, label: t.label }));
}

function resolveEnabledTestIds(options: CustomActSuiteOptions): Set<string> {
  const { enabledTests } = options;

  if (enabledTests && enabledTests.length > 0) {
    return new Set(enabledTests);
  }

  const defaultIds = REGISTERED_TESTS
    .filter((test) => test.defaultEnabled)
    .map((test) => test.id);

  return new Set(defaultIds);
}

async function runRegisteredTests(
  page: Page,
  url: string,
  enabledTestIds: Set<string>,
): Promise<CustomActSuiteResult> {
  const allViolations: AccessibilityViolation[] = [];
  const allActionItems: HumanReadableActionItem[] = [];
  let pageDimensions: { width: number; height: number } | undefined;

  for (const test of REGISTERED_TESTS) {
    if (!enabledTestIds.has(test.id)) {
      continue;
    }

    try {
      const result = await test.run(page, url);
      if (!result) {
        continue;
      }

      if (Array.isArray(result.violations)) {
        allViolations.push(...result.violations);
      }

      if (Array.isArray(result.actionItems)) {
        allActionItems.push(...result.actionItems);
      }
      
      if ('pageDimensions' in result && result.pageDimensions) {
        pageDimensions = result.pageDimensions;
      }
    } catch (error) {
      console.warn('[CustomACT] Test failed:', test.id, error);
    }
  }

  return {
    violations: allViolations,
    actionItems: allActionItems,
    pageDimensions
  };
}
