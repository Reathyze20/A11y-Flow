/**
 * DTO (Data Transfer Objects) pro A11yFlow.
 */

export type ImpactLevel = 'minor' | 'moderate' | 'serious' | 'critical';

// Lidsky čitelné priority pro manažerský report
export type HumanReadablePriority =
  | '🔴 Critical'
  | '🟠 Serious'
  | '🟡 Moderate'
  | '🔵 Minor';

// Vysokoúrovňové kategorie problémů
export type HumanReadableCategory =
  | 'Graphics'
  | 'Forms'
  | 'Content'
  | 'Navigation'
  | 'Structure'
  | 'Technical';

export interface ViolationNode {
  html: string;
  target: string[];
  failureSummary: string;
  screenshotUrl?: string;
  // Technický selector prvku (např. tag#id nebo tag.class), pokud ho umíme určit
  cssSelector?: string;
  // Lidsky čitelný popis prvku (např. "Tlačítko \"Přihlásit se\" v hlavním menu")
  elementLabel?: string;
  // Stabilní identifikátor prvku napříč běhy (kombinace URL/selector/label)
  fingerprint?: string;
  // Heuristický název komponenty / design‑system prvku (např. PrimaryButton)
  componentName?: string;
  // Bounding box prvku na stránce (pro screenshot annotator)
  boundingBox?: { x: number; y: number; width: number; height: number };
  // Číslo anotace na screenshotu (pro reference v reportu)
  annotationNumber?: number;
  // Impact level tohoto konkrétního node (pro color-coding v annotaci)
  impact?: ImpactLevel;
}

export interface AccessibilityViolation {
  id: string;
  title: string;
  description: string;
  impact: ImpactLevel | null;
  helpUrl?: string;
  nodes: ViolationNode[];
  count: number;
  suggestedFix?: string; 
  // Volitelná vazba na W3C ACT Rule(s), pokud ji umíme z axe-core nebo custom testu odvodit
  actRuleIds?: string[];
  actRuleUrls?: string[];
}

// Snippet s ukázkou opravy kódu
export interface CodeSnippet {
  before: string;  // Špatný kód
  after: string;   // Opravený kód
  language: string; // 'html', 'css', 'javascript'
  explanation: string; // Vysvětlení co je špatně a proč
}

// Jeden konkrétní úkol do To‑Do listu
export interface HumanReadableActionItem {
  id: string;                 // např. color-contrast
  impact: ImpactLevel | null; // původní axe impact
  priority: HumanReadablePriority;
  category: HumanReadableCategory;
  what: string;               // lidský popis problému
  fix: string;                // jak opravit (z RemediationService)
  exampleUrl: string;         // URL stránky, kde se problém vyskytuje
  exampleTarget?: string;     // typický selector / umístění prvku
  wcagReference?: string;     // např. "1.4.3 Kontrast (minimální)"
  // Přímá reference na ACT Rules (např. "b4f0c3") a jejich URL, pokud dostupné
  actRuleIds?: string[];
  actRuleUrls?: string[];
  // Krátký technický popis z axe (např. failureSummary prvního uzlu) – pro detailní kontext v reportu
  technicalSummary?: string;
  // Lidsky čitelný popis konkrétního prvku (role + název), pro seznam "problémových prvků"
  elementLabel?: string;
   // Stabilní identifikátor prvku napříč běhy (pokud dostupný)
   fingerprint?: string;
   // Heuristický název komponenty / design‑system prvku, do které prvek pravděpodobně patří
   componentName?: string;
   // Konkrétní snippet s ukázkou jak opravit (pro Fix-it Code Snippets feature)
   codeSnippet?: CodeSnippet;
}

export interface HumanReadableReport {
  actionItems: HumanReadableActionItem[]; // všechny úkoly (flatten)
  topIssues: HumanReadableActionItem[];   // Top 3 dle priority
}

// Informace o rozbitých odkazech na stránce
export interface BrokenLinkInfo {
  url: string;
  status: number | null;
  ok: boolean;
}

export interface BrokenLinksSummary {
  totalChecked: number;
  broken: BrokenLinkInfo[];
}

// Core Web Vitals a základní výkonové metriky
export interface CoreWebVitalsMetrics {
  lcp?: number | null; // Largest Contentful Paint (ms)
  cls?: number | null; // Cumulative Layout Shift
  inp?: number | null; // Interaction to Next Paint (ms)
  tbt?: number | null; // Total Blocking Time (ms)
}

export interface NavigationTimingMetrics {
  firstContentfulPaint?: number | null;
  timeToFirstByte?: number | null;
  domContentLoaded?: number | null;
  loadEvent?: number | null;
}

export interface PerformanceReport {
  coreWebVitals: CoreWebVitalsMetrics;
  navigation: NavigationTimingMetrics;
}

// Klávesnicová navigace – „tab‑walk“ report
export type KeyboardIssueType =
  | 'focus-lost'
  | 'focus-loop'
  | 'no-visible-focus'
  | 'no-focusable-elements'
  | 'offscreen-focus';

export interface KeyboardNavigationIssue {
  type: KeyboardIssueType;
  step: number;
  description: string;
  selector?: string;
   // Krátký HTML výřez aktivního prvku (pro lepší kontext)
   htmlSnippet?: string;
   // Odkaz na relevantní WCAG kritérium, např. "2.4.7 Focus Visible"
   wcagReference?: string;
   // Doporučení, jak problém opravit (pár vět)
   recommendation?: string;
}

export interface KeyboardNavigationReport {
  totalSteps: number;
  issues: KeyboardNavigationIssue[];
}

// Heading structure pro kontrolu hierarchie nadpisů
export interface HeadingInfo {
  level: number; // 1-6 (h1-h6)
  text: string;
  selector?: string;
}

export interface HeadingStructure {
  headings: HeadingInfo[];
  issues: {
    type: 'missing-h1' | 'multiple-h1' | 'skipped-level' | 'empty-heading' | 
          'first-not-h1' | 'duplicate-headings' | 'generic-heading' | 'very-long-heading' | 'very-short-heading';
    description: string;
    wcagReference?: string;
    affectedHeadings?: HeadingInfo[]; // Konkrétní nadpisy, které způsobují problém
  }[];
}

export interface PageDimensions {
  width: number;
  height: number;
}

export interface AuditReport {
  url: string;
  timestamp: string;
  score: number;
  fullPageScreenshot?: string; // Base64 encoded JPEG
  annotatedScreenshot?: string; // Base64 encoded JPEG s anotacemi (červené boxy)
  annotatedScreenshotUrl?: string; // S3 URL pro annotated screenshot
  htmlSnapshot?: string; // Full DOM HTML
  pageDimensions?: PageDimensions;
  meta: {
    browserVersion: string;
    engineVersion: string;
  };
  violations: {
    critical: AccessibilityViolation[];
    serious: AccessibilityViolation[];
    moderate: AccessibilityViolation[];
    minor: AccessibilityViolation[];
  };
  stats: {
    totalViolations: number;
    criticalCount: number;
  };
  // Zploštělá, lidsky čitelná podoba reportu pro Make.com / Google Docs
  humanReadable: HumanReadableReport;
  // Volitelný blok s rozbitými odkazy (HTTP 4xx/5xx)
  brokenLinks?: BrokenLinksSummary;
  // Volitelný blok s výkonovými metrikami (Core Web Vitals + navigation)
  performance?: PerformanceReport;
  // Volitelný blok s výsledkem klávesnicové navigace
  keyboardNavigation?: KeyboardNavigationReport;
  // Struktura nadpisů na stránce
  headingStructure?: HeadingStructure;
  // Auto-generované prohlášení o přístupnosti (Markdown)
  accessibilityStatement?: string;
  // Auto-generované prohlášení o přístupnosti (HTML)
  accessibilityStatementHtml?: string;
  // URL ke stažení PDF verze reportu (pokud vygenerován)
  pdfUrl?: string;
  // Hash domény pro badge lookup
  domainHash?: string;
  
  // SPA & Shadow DOM metadata (pokud detekováno)
  spaMetadata?: {
    detectedFramework?: 'react' | 'vue' | 'angular' | 'unknown';
    hasClientSideRouting: boolean;
    hydrationTime?: number; // ms
    stabilityTime?: number; // ms
  };
  
  shadowDOMMetadata?: {
    hasShadowDOM: boolean;
    shadowHostCount: number;
    closedShadowRoots: number;
    webComponents: string[]; // List of custom element names
  };
}

export interface CrawlSummary {
  rootUrl: string;
  totalPagesScanned: number;
  averageScore: number;
  totalCriticalViolations: number;
  totalViolations: number; // NOVÉ: Celkový počet všech chyb
  pages: AuditReport[];
  // Agregované Core Web Vitals přes všechny stránky (pokud dostupné)
  performanceSummary?: {
    averageLcp?: number | null;
    averageCls?: number | null;
    averageInp?: number | null;
    averageTbt?: number | null;
  };
}