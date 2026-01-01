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
}

interface FormErrorsDomScanResult {
  problems: FormErrorProblem[];
}

// Pro tento custom test zatím neexistuje oficiální ACT Rule ID,
// proto ho do reportu nepropagujeme jako ACT pravidlo.

export async function runFormErrorsActTest(
  page: Page,
  pageUrl: string,
): Promise<FormErrorsActResult | null> {
  const impact: ImpactLevel = 'serious';

  const problems = await findFormsWithoutErrorMechanism(page);
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

async function findFormsWithoutErrorMechanism(page: Page): Promise<FormErrorProblem[]> {
  const rawResult = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) {
      return { problems: [] as any[] };
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
          .map((c: string) => `.${c}`)
          .join('');
        if (cls) return `${tag}${cls}`;
      }
      return tag;
    };

    const forms = Array.from(d.querySelectorAll('form')) as any[];
    const problems: any[] = [];

    for (const form of forms) {
      const requiredFields = Array.from(
        form.querySelectorAll(
          'input[required], textarea[required], select[required], input[aria-required="true"], textarea[aria-required="true"], select[aria-required="true"]',
        ),
      ) as any[];

      if (!requiredFields || requiredFields.length === 0) continue;

      const errorRegion = form.querySelector(
        '[role="alert"], [aria-live], .error, .error-message, .validation-error, .form-error',
      );

      let hasErrorMechanism = !!errorRegion;

      if (!hasErrorMechanism) {
        const errorTokens = ['error', 'chyba', 'chybně', 'povinné', 'required', 'invalid'];

        for (const field of requiredFields) {
          const describedBy =
            (field.getAttribute && field.getAttribute('aria-describedby')) || '';
          if (!describedBy) continue;

          const ids = String(describedBy)
            .split(/\s+/)
            .filter(Boolean);

          for (const id of ids) {
            const el = d.getElementById(id);
            if (!el || !el.textContent) continue;
            const text = el.textContent.toLowerCase();
            if (errorTokens.some((t) => text.includes(t))) {
              hasErrorMechanism = true;
              break;
            }
          }

          if (hasErrorMechanism) break;
        }
      }

      if (hasErrorMechanism) continue;

      const selector = makeSelector(form);

      let htmlSnippet = '';
      try {
        const outer = (form as any).outerHTML || '';
        htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      const legend = form.querySelector('legend, h1, h2, h3, [role="heading"]') as any;
      const ariaLabel = form.getAttribute && form.getAttribute('aria-label');
      let labelText = '';
      if (ariaLabel) {
        labelText = String(ariaLabel);
      } else if (legend && legend.textContent) {
        labelText = String(legend.textContent);
      }
      labelText = (labelText || '').trim();

      problems.push({
        selector,
        htmlSnippet,
        labelText,
      });
    }

    return { problems };
  });

  const result = rawResult as FormErrorsDomScanResult | null;
  if (!result || !Array.isArray(result.problems)) {
    return [];
  }

  return result.problems;
}

function buildFormErrorsViolation(
  problems: FormErrorProblem[],
  impact: ImpactLevel,
): AccessibilityViolation {
  const violationNodes = problems.map((problem) => ({
    html: problem.htmlSnippet || '',
    target: problem.selector ? [problem.selector] : [],
    failureSummary:
      'Formulář obsahuje povinná pole, ale není zde detekovatelný region pro chybové zprávy (role="alert", aria-live nebo typické .error prvky).',
  }));

  return {
    id: 'a11yflow-form-errors',
    title: 'Nesrozumitelné nebo neoznámené chyby ve formuláři',
    description:
      'Byly nalezeny formuláře s povinnými poli, u kterých nelze detekovat region pro chybové zprávy. Uživatelé tak nemusí zjistit, co je špatně.',
    impact,
    helpUrl: undefined,
    count: violationNodes.length,
    suggestedFix:
      'Zobrazte chybové zprávy v blízkosti polí, navázejte je na inputy přes aria-describedby/id a po chybě přesuňte focus na první problém nebo shrnutí chyb. Zvažte použití regionu s role="alert" nebo aria-live.',
    nodes: violationNodes,
  };
}

function buildFormErrorsActionItem(
  violation: AccessibilityViolation,
  firstProblem: FormErrorProblem,
  pageUrl: string,
  impact: ImpactLevel,
): HumanReadableActionItem {
  const exampleTarget = firstProblem.selector || undefined;
  const labelText = firstProblem.labelText || '';

  return {
    id: violation.id,
    impact,
    priority: '🟠 Vysoká',
    category: 'Formuláře',
    what:
      'Formulář(e) mají povinná pole, ale uživatel nemá k dispozici jasně čitelné a programově detekovatelné chybové zprávy.',
    fix: 'Uspořádejte validaci tak, aby byly chyby jasně vizuálně označeny, navázané na pole a aby focus zamířil na první chybu nebo shrnutí chyb. Chybové zprávy oznamujte přes aria-live nebo role="alert".',
    exampleUrl: pageUrl,
    exampleTarget,
    elementLabel: labelText ? `Formulář "${labelText}"` : 'Formulář',
    wcagReference: '3.3.1 Identifikace chyby',
  };
}
