import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface FormErrorsActResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

interface FormErrorProblem {
  selector: string;
  htmlSnippet: string;
  labelText: string;
  issueType: 'no-error-mechanism' | 'no-aria-invalid' | 'no-focus-management';
}

interface FormInfo {
  selector: string;
  htmlSnippet: string;
  labelText: string;
  hasRequiredFields: boolean;
  submitButtonSelector: string | null;
}

interface FormStateSnapshot {
  ariaInvalidCount: number;
  errorRegionCount: number;
  errorTextCount: number;
  activeElementSelector: string | null;
}

// Rozšířený slovník chybových slov (CZ, SK, EN, DE)
const ERROR_TOKENS = [
  // Czech
  'chyba', 'chybně', 'povinné', 'vyplňte', 'neplatné', 'špatně', 'musíte',
  // Slovak
  'chyba', 'povinné', 'vyplňte', 'neplatné',
  // English
  'error', 'required', 'invalid', 'please fill', 'must', 'cannot be empty',
  // German
  'fehler', 'pflichtfeld', 'ungültig', 'erforderlich',
];

// Pro tento custom test zatím neexistuje oficiální ACT Rule ID,
// proto ho do reportu nepropagujeme jako ACT pravidlo.

export async function runFormErrorsActTest(
  page: Page,
  pageUrl: string,
): Promise<FormErrorsActResult | null> {
  const impact: ImpactLevel = 'serious';

  // Fáze 1: Najít formuláře s povinnými poli
  const forms = await findFormsWithRequiredFields(page);
  if (forms.length === 0) {
    return null;
  }

  const problems: FormErrorProblem[] = [];

  // Fáze 2: Pro každý formulář provést submit test
  for (const form of forms) {
    const formProblems = await testFormErrorBehavior(page, form);
    problems.push(...formProblems);
  }

  if (problems.length === 0) {
    return null;
  }

  const violation = buildFormErrorsViolation(problems, impact);
  const actionItem = buildFormErrorsActionItem(violation, problems[0], pageUrl, impact);

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}

async function findFormsWithRequiredFields(page: Page): Promise<FormInfo[]> {
  const rawResult = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) {
      return { forms: [] as any[] };
    }

    const makeSelector = (el: any): string => {
      if (!el) return '';
      const tag = (el.tagName || 'div').toLowerCase();
      if (el.id) return `${tag}#${el.id}`;
      const className = el.className;
      if (className && typeof className === 'string') {
        const cls = className
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c: string) => `.${c}`)
          .join('');
        if (cls) return `${tag}${cls}`;
      }
      return tag;
    };

    const forms = Array.from(d.querySelectorAll('form')) as any[];
    const result: any[] = [];

    for (const form of forms) {
      const requiredFields = form.querySelectorAll(
        'input[required], textarea[required], select[required], ' +
        'input[aria-required="true"], textarea[aria-required="true"], select[aria-required="true"]',
      );

      if (!requiredFields || requiredFields.length === 0) continue;

      const submitBtn = form.querySelector(
        'button[type="submit"], input[type="submit"], button:not([type])',
      );

      const legend = form.querySelector('legend, h1, h2, h3, [role="heading"]') as any;
      const ariaLabel = form.getAttribute && form.getAttribute('aria-label');
      let labelText = ariaLabel || (legend && legend.textContent) || '';
      labelText = String(labelText).trim();

      let htmlSnippet = '';
      try {
        const outer = (form as any).outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      result.push({
        selector: makeSelector(form),
        htmlSnippet,
        labelText,
        hasRequiredFields: true,
        submitButtonSelector: submitBtn ? makeSelector(submitBtn) : null,
      });
    }

    return { forms: result };
  });

  return (rawResult as any)?.forms || [];
}

async function captureFormState(page: Page, formSelector: string): Promise<FormStateSnapshot> {
  const state = await page.evaluate((selector: string) => {
    const d = (globalThis as any).document as any;
    const form = d.querySelector(selector);
    if (!form) {
      return {
        ariaInvalidCount: 0,
        errorRegionCount: 0,
        errorTextCount: 0,
        activeElementSelector: null,
      };
    }

    const ariaInvalidCount = form.querySelectorAll('[aria-invalid="true"]').length;
    const errorRegionCount = form.querySelectorAll(
      '[role="alert"], [aria-live="polite"], [aria-live="assertive"]',
    ).length;

    // Počet prvků s chybovým textem
    const allText = form.innerText || '';
    const errorTokens = ['error', 'chyba', 'povinné', 'required', 'invalid', 'fehler'];
    const errorTextCount = errorTokens.reduce((count, token) => {
      const regex = new RegExp(token, 'gi');
      const matches = allText.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);

    const active = d.activeElement;
    let activeSelector = null;
    if (active && form.contains(active)) {
      const tag = (active.tagName || 'div').toLowerCase();
      if (active.id) {
        activeSelector = `${tag}#${active.id}`;
      } else if (active.name) {
        activeSelector = `${tag}[name="${active.name}"]`;
      } else {
        activeSelector = tag;
      }
    }

    return {
      ariaInvalidCount,
      errorRegionCount,
      errorTextCount,
      activeElementSelector: activeSelector,
    };
  }, formSelector);

  return state as FormStateSnapshot;
}

async function testFormErrorBehavior(
  page: Page,
  form: FormInfo,
): Promise<FormErrorProblem[]> {
  const problems: FormErrorProblem[] = [];

  // Zachytit stav PŘED submitem
  const stateBefore = await captureFormState(page, form.selector);

  // Pokusit se odeslat formulář (bez vyplnění povinných polí)
  let submitSucceeded = false;
  try {
    if (form.submitButtonSelector) {
      // Kliknout na submit button
      const btn = await page.$(form.submitButtonSelector);
      if (btn) {
        await btn.click();
        submitSucceeded = true;
      }
    }

    if (!submitSucceeded) {
      // Fallback: zkusit odeslat formulář přes JS
      await page.evaluate((selector: string) => {
        const d = (globalThis as any).document as any;
        const f = d.querySelector(selector);
        if (f && typeof f.requestSubmit === 'function') {
          try {
            f.requestSubmit();
          } catch {
            // Některé prohlížeče/stránky to blokují
          }
        }
      }, form.selector);
      submitSucceeded = true;
    }
  } catch {
    // Submit se nepovedl – přeskočíme dynamický test
  }

  if (!submitSucceeded) {
    // Fallback na statickou kontrolu (původní logika)
    const hasStaticErrorMechanism = await checkStaticErrorMechanism(page, form.selector);
    if (!hasStaticErrorMechanism) {
      problems.push({
        selector: form.selector,
        htmlSnippet: form.htmlSnippet,
        labelText: form.labelText,
        issueType: 'no-error-mechanism',
      });
    }
    return problems;
  }

  // Počkat na případné DOM změny (validace, error messages)
  await new Promise((r) => setTimeout(r, 500));

  // 3. Kontrola nativní validace
  const isNativeInvalid = await page.evaluate((selector: string) => {
    const d = (globalThis as any).document;
    const f = d.querySelector(selector);
    if (!f) return false;
    // Pokud má form novalidate, prohlížeč nezobrazí bubliny
    if (f.noValidate) return false;
    return f.checkValidity() === false;
  }, form.selector);

  if (isNativeInvalid) {
    return [];
  }

  // Zachytit stav PO submitu
  const stateAfter = await captureFormState(page, form.selector);

  // Vyhodnotit rozdíly
  const ariaInvalidAdded = stateAfter.ariaInvalidCount > stateBefore.ariaInvalidCount;
  const errorRegionAdded = stateAfter.errorRegionCount > stateBefore.errorRegionCount;
  const errorTextAdded = stateAfter.errorTextCount > stateBefore.errorTextCount;
  const focusMovedToField = stateAfter.activeElementSelector !== null;

  // Problém 1: Žádné aria-invalid po submitu
  if (!ariaInvalidAdded && !errorRegionAdded && !errorTextAdded) {
    problems.push({
      selector: form.selector,
      htmlSnippet: form.htmlSnippet,
      labelText: form.labelText,
      issueType: 'no-error-mechanism',
    });
  } else if (!ariaInvalidAdded) {
    // Chybové zprávy se objevily, ale aria-invalid není nastaveno
    problems.push({
      selector: form.selector,
      htmlSnippet: form.htmlSnippet,
      labelText: form.labelText,
      issueType: 'no-aria-invalid',
    });
  }

  // Problém 2: Focus se nepřesunul na chybné pole
  if ((ariaInvalidAdded || errorTextAdded) && !focusMovedToField) {
    problems.push({
      selector: form.selector,
      htmlSnippet: form.htmlSnippet,
      labelText: form.labelText,
      issueType: 'no-focus-management',
    });
  }

  return problems;
}

async function checkStaticErrorMechanism(page: Page, formSelector: string): Promise<boolean> {
  const result = await page.evaluate(
    (selector: string, errorTokens: string[]) => {
      const d = (globalThis as any).document as any;
      const form = d.querySelector(selector);
      if (!form) return true;

      // Hledat error region
      const errorRegion = form.querySelector(
        '[role="alert"], [aria-live], .error, .error-message, .validation-error, .form-error',
      );
      if (errorRegion) return true;

      // Hledat aria-describedby s chybovým textem
      const requiredFields = form.querySelectorAll(
        'input[required], textarea[required], select[required], ' +
        'input[aria-required="true"], textarea[aria-required="true"], select[aria-required="true"]',
      );

      for (const field of Array.from(requiredFields) as any[]) {
        const describedBy = field.getAttribute('aria-describedby') || '';
        if (!describedBy) continue;

        const ids = String(describedBy).split(/\s+/).filter(Boolean);
        for (const id of ids) {
          const el = d.getElementById(id);
          if (!el || !el.textContent) continue;
          const text = el.textContent.toLowerCase();
          if (errorTokens.some((t: string) => text.includes(t))) {
            return true;
          }
        }
      }

      return false;
    },
    formSelector,
    ERROR_TOKENS,
  );

  return result as boolean;
}

function buildFormErrorsViolation(
  problems: FormErrorProblem[],
  impact: ImpactLevel,
): AccessibilityViolation {
  const violationNodes = problems.map((problem) => ({
    html: problem.htmlSnippet || '',
    target: problem.selector ? [problem.selector] : [],
    failureSummary: getFailureSummaryForIssueType(problem.issueType),
  }));

  return {
    id: 'a11yflow-form-errors',
    title: 'Problémy s chybovými hláškami ve formuláři',
    description:
      'Byly nalezeny formuláře s povinnými poli, u kterých chybí správné oznámení chyb uživateli. ' +
      'To může zahrnovat chybějící chybové regiony, chybějící aria-invalid atributy nebo špatnou správu focusu.',
    impact,
    helpUrl: undefined,
    count: violationNodes.length,
    suggestedFix:
      'Po odeslání neplatného formuláře: 1) Nastavte aria-invalid="true" na chybná pole. ' +
      '2) Zobrazte chybové zprávy v regionu s role="alert" nebo aria-live. ' +
      '3) Přesuňte focus na první chybné pole nebo shrnutí chyb.',
    nodes: violationNodes,
  };
}

function getFailureSummaryForIssueType(issueType: FormErrorProblem['issueType']): string {
  switch (issueType) {
    case 'no-error-mechanism':
      return 'Formulář obsahuje povinná pole, ale po odeslání se neobjevily žádné chybové zprávy ani aria-invalid atributy.';
    case 'no-aria-invalid':
      return 'Formulář zobrazuje chybové zprávy, ale chybná pole nemají nastaveno aria-invalid="true" pro čtečky obrazovky.';
    case 'no-focus-management':
      return 'Po zobrazení chyb se focus nepřesunul na chybné pole ani na shrnutí chyb. Uživatel klávesnice neví, kde začít s opravou.';
    default:
      return 'Formulář má problémy s oznámením chyb uživateli.';
  }
}

function buildFormErrorsActionItem(
  violation: AccessibilityViolation,
  firstProblem: FormErrorProblem,
  pageUrl: string,
  impact: ImpactLevel,
): HumanReadableActionItem {
  const exampleTarget = firstProblem.selector || undefined;
  const labelText = firstProblem.labelText || '';

  const issueSpecificFix = getFixForIssueType(firstProblem.issueType);

  return {
    id: violation.id,
    impact,
    priority: '🟠 Serious',
    category: 'Forms',
    what: getWhatForIssueType(firstProblem.issueType),
    fix: issueSpecificFix,
    exampleUrl: pageUrl,
    exampleTarget,
    elementLabel: labelText ? `Formulář "${labelText}"` : 'Formulář',
    wcagReference: '3.3.1 Identifikace chyby',
  };
}

function getWhatForIssueType(issueType: FormErrorProblem['issueType']): string {
  switch (issueType) {
    case 'no-error-mechanism':
      return 'Formulář má povinná pole, ale po odeslání s chybami se nezobrazily žádné chybové zprávy.';
    case 'no-aria-invalid':
      return 'Formulář zobrazuje chybové zprávy, ale chybná pole nemají aria-invalid="true".';
    case 'no-focus-management':
      return 'Po zobrazení chyb ve formuláři se focus nepřesunul na problémové místo.';
    default:
      return 'Formulář má problémy s oznámením chyb uživateli.';
  }
}

function getFixForIssueType(issueType: FormErrorProblem['issueType']): string {
  switch (issueType) {
    case 'no-error-mechanism':
      return 'Implementujte validaci s viditelnými chybovými zprávami. Použijte role="alert" nebo aria-live="polite" pro oznámení chyb čtečkám obrazovky.';
    case 'no-aria-invalid':
      return 'Přidejte aria-invalid="true" na všechna pole, která mají chybu. Čtečky obrazovky tak uživateli oznámí, že pole obsahuje neplatnou hodnotu.';
    case 'no-focus-management':
      return 'Po odeslání formuláře s chybami přesuňte focus na první chybné pole nebo na shrnutí chyb (např. element s role="alert").';
    default:
      return 'Zkontrolujte implementaci validace formuláře z pohledu přístupnosti.';
  }
}
