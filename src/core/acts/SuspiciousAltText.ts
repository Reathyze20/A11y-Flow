import { Page } from 'puppeteer-core';
import { AccessibilityViolation, HumanReadableActionItem, ImpactLevel } from '../types';

export interface SuspiciousAltTextResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
}

interface SuspiciousAltProblem {
  selector: string;
  htmlSnippet: string;
  altText: string;
  issueType: 'filename' | 'placeholder' | 'too-short' | 'redundant';
}

// Vzory, které naznačují, že alt text je název souboru
const FILENAME_PATTERNS = [
  /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico|tiff?)$/i,
  /^IMG_\d+/i,
  /^DSC_?\d+/i,
  /^DCIM/i,
  /^image\s*\d*/i,
  /^photo\s*\d*/i,
  /^picture\s*\d*/i,
  /^screenshot/i,
  /^untitled/i,
  /^\d{8,}/,  // Jen číselné názvy (timestamp-like)
];

// Placeholder texty, které nejsou smysluplné
const PLACEHOLDER_PATTERNS = [
  /^alt$/i,
  /^image$/i,
  /^obrázek$/i,
  /^foto$/i,
  /^photo$/i,
  /^picture$/i,
  /^banner$/i,
  /^logo$/i,
  /^icon$/i,
  /^ikona$/i,
  /^placeholder$/i,
  /^zde$/i,
  /^here$/i,
  /^\.+$/,  // Jen tečky
  /^\s*$/,  // Prázdné nebo jen mezery (pro případ, že by axe nepokrylo)
];

// Redundantní fráze (obrázek něčeho, fotka něčeho)
const REDUNDANT_PREFIXES = [
  /^obrázek\s+(of\s+)?/i,
  /^fotografie\s+(of\s+)?/i,
  /^fotka\s+(of\s+)?/i,
  /^image\s+of\s+/i,
  /^photo\s+of\s+/i,
  /^picture\s+of\s+/i,
  /^graphic\s+of\s+/i,
  /^icon\s+of\s+/i,
];

export async function runSuspiciousAltTextTest(
  page: Page,
  pageUrl: string,
): Promise<SuspiciousAltTextResult | null> {
  const impact: ImpactLevel = 'moderate';

  const problems = await findSuspiciousAltTexts(page);
  if (problems.length === 0) {
    return null;
  }

  const violation = buildSuspiciousAltViolation(problems, impact);
  const actionItem = buildSuspiciousAltActionItem(violation, problems[0], pageUrl, impact);

  return {
    violations: [violation],
    actionItems: [actionItem],
  };
}

async function findSuspiciousAltTexts(page: Page): Promise<SuspiciousAltProblem[]> {
  const rawResult = await page.evaluate(() => {
    const d = (globalThis as any).document as any;
    if (!d) {
      return { images: [] as any[] };
    }

    const makeSelector = (el: any): string => {
      if (!el) return '';
      const tag = (el.tagName || 'img').toLowerCase();
      if (el.id) return `${tag}#${el.id}`;
      const src = el.getAttribute('src') || '';
      if (src) {
        const filename = src.split('/').pop()?.split('?')[0] || '';
        if (filename) return `${tag}[src*="${filename.slice(0, 30)}"]`;
      }
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

    // Najít všechny obrázky s alt textem (ne prázdným)
    const images = Array.from(d.querySelectorAll('img[alt]')) as any[];
    const result: any[] = [];

    for (const img of images) {
      const alt = (img.getAttribute('alt') || '').trim();
      
      // Přeskočit prázdné alt (ty jsou OK pro dekorativní obrázky)
      if (!alt) continue;

      let htmlSnippet = '';
      try {
        const outer = (img as any).outerHTML || '';
        htmlSnippet = outer.length > 300 ? outer.slice(0, 300) + '…' : outer;
      } catch {
        htmlSnippet = '';
      }

      result.push({
        selector: makeSelector(img),
        htmlSnippet,
        altText: alt,
      });
    }

    return { images: result };
  });

  const images = (rawResult as any)?.images || [];
  const problems: SuspiciousAltProblem[] = [];

  for (const img of images) {
    const alt = img.altText || '';
    const issueType = detectAltTextIssue(alt);
    
    if (issueType) {
      problems.push({
        selector: img.selector,
        htmlSnippet: img.htmlSnippet,
        altText: alt,
        issueType,
      });
    }
  }

  return problems;
}

function detectAltTextIssue(alt: string): SuspiciousAltProblem['issueType'] | null {
  const trimmed = alt.trim();

  // Kontrola názvu souboru
  for (const pattern of FILENAME_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'filename';
    }
  }

  // Kontrola placeholder textu
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return 'placeholder';
    }
  }

  // Příliš krátký alt text (méně než 3 znaky, pokud to není zkratka)
  if (trimmed.length < 3 && !/^[A-Z]{2,3}$/.test(trimmed)) {
    return 'too-short';
  }

  // Redundantní prefix
  for (const pattern of REDUNDANT_PREFIXES) {
    if (pattern.test(trimmed)) {
      return 'redundant';
    }
  }

  return null;
}

function buildSuspiciousAltViolation(
  problems: SuspiciousAltProblem[],
  impact: ImpactLevel,
): AccessibilityViolation {
  const violationNodes = problems.map((problem) => ({
    html: problem.htmlSnippet || '',
    target: problem.selector ? [problem.selector] : [],
    failureSummary: getAltFailureSummary(problem),
  }));

  return {
    id: 'a11yflow-suspicious-alt',
    title: 'Podezřelý nebo nesmyslný alternativní text obrázku',
    description:
      'Byly nalezeny obrázky s alt textem, který vypadá jako název souboru, placeholder nebo jinak nesmyslný text. ' +
      'Takový alt text nepomáhá nevidomým uživatelům pochopit obsah obrázku.',
    impact,
    helpUrl: undefined,
    count: violationNodes.length,
    suggestedFix:
      'Nahraďte alt text smysluplným popisem, který vystihuje účel nebo obsah obrázku. ' +
      'Pokud je obrázek čistě dekorativní, použijte prázdný alt="" a případně role="presentation".',
    nodes: violationNodes,
  };
}

function getAltFailureSummary(problem: SuspiciousAltProblem): string {
  const altPreview = problem.altText.length > 50 
    ? problem.altText.slice(0, 47) + '…' 
    : problem.altText;

  switch (problem.issueType) {
    case 'filename':
      return `Alt text "${altPreview}" vypadá jako název souboru. Nevidomý uživatel z něj nezíská žádnou užitečnou informaci.`;
    case 'placeholder':
      return `Alt text "${altPreview}" je obecný placeholder bez konkrétního významu.`;
    case 'too-short':
      return `Alt text "${altPreview}" je příliš krátký na to, aby smysluplně popisoval obrázek.`;
    case 'redundant':
      return `Alt text "${altPreview}" obsahuje redundantní frázi (např. "obrázek", "fotka"). Čtečky obrazovky už oznamují, že jde o obrázek.`;
    default:
      return `Alt text "${altPreview}" může být problematický.`;
  }
}

function buildSuspiciousAltActionItem(
  violation: AccessibilityViolation,
  firstProblem: SuspiciousAltProblem,
  pageUrl: string,
  impact: ImpactLevel,
): HumanReadableActionItem {
  const exampleTarget = firstProblem.selector || undefined;

  return {
    id: violation.id,
    impact,
    priority: '🟡 Moderate',
    category: 'Graphics',
    what: getAltWhatDescription(firstProblem),
    fix: getAltFixDescription(firstProblem.issueType),
    exampleUrl: pageUrl,
    exampleTarget,
    elementLabel: `Obrázek s alt="${firstProblem.altText.slice(0, 30)}${firstProblem.altText.length > 30 ? '…' : ''}"`,
    wcagReference: '1.1.1 Netextový obsah',
  };
}

function getAltWhatDescription(problem: SuspiciousAltProblem): string {
  switch (problem.issueType) {
    case 'filename':
      return `Obrázek má alt text, který vypadá jako název souboru ("${problem.altText.slice(0, 30)}…").`;
    case 'placeholder':
      return `Obrázek má obecný placeholder alt text ("${problem.altText}"), který neposkytuje žádnou informaci.`;
    case 'too-short':
      return `Obrázek má příliš krátký alt text ("${problem.altText}").`;
    case 'redundant':
      return `Obrázek má alt text s redundantní frází ("${problem.altText.slice(0, 30)}…").`;
    default:
      return 'Obrázek má podezřelý alt text.';
  }
}

function getAltFixDescription(issueType: SuspiciousAltProblem['issueType']): string {
  switch (issueType) {
    case 'filename':
      return 'Nahraďte název souboru smysluplným popisem obsahu obrázku. Např. místo "IMG_1234.jpg" použijte "Pohled na Pražský hrad z Karlova mostu".';
    case 'placeholder':
      return 'Nahraďte obecný text konkrétním popisem. Pokud je obrázek dekorativní, použijte prázdný alt="".';
    case 'too-short':
      return 'Rozšiřte alt text tak, aby smysluplně popisoval obrázek. Ideálně 5–15 slov.';
    case 'redundant':
      return 'Odstraňte slova jako "obrázek", "fotka", "ikona" ze začátku alt textu. Čtečky obrazovky už oznamují, že jde o obrázek.';
    default:
      return 'Zkontrolujte a upravte alt text obrázku.';
  }
}
