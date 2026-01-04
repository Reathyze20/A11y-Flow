# A11y-Flow - Kompletní Dokumentace pro AI Asistenta

> **Datum:** 3. ledna 2026  
> **Verze:** 1.0.0  
> **Status:** Production Ready

## 📋 Obsah

1. [Přehled projektu](#přehled-projektu)
2. [Architektura](#architektura)
3. [Klíčové komponenty](#klíčové-komponenty)
4. [WCAG & ACT Rules pokrytí](#wcag--act-rules-pokrytí)
5. [Datové struktury](#datové-struktury)
6. [Workflow](#workflow)
7. [Deployment](#deployment)
8. [Testování](#testování)
9. [Současný stav](#současný-stav)

---

## Přehled projektu

### Účel
Automatizovaný nástroj pro testování přístupnosti webů běžící jako **AWS Lambda funkce**. Kombinuje:
- **axe-core** - statická analýza DOM
- **Custom ACT-like testy** - vlastní E2E testy pomocí Puppeteer
- **Lidsky čitelné reporty** - JSON + HTML výstupy s akcemi k nápravě

### Tech Stack
- **Runtime:** Node.js (AWS Lambda)
- **Language:** TypeScript
- **Browser:** Puppeteer + @sparticuz/chromium (headless)
- **A11y Engine:** axe-core 4.8.3
- **Cloud:** AWS (Lambda, S3, DynamoDB, API Gateway)
- **Build:** esbuild (single bundle)

### Klíčové Vlastnosti
✅ WCAG 2.1 / 2.2 pokrytí (Level A, AA)  
✅ 12 custom ACT-like testů (focus, modals, forms, landmarks...)  
✅ Mapování na W3C ACT Rules  
✅ Screenshot + HTML snapshot  
✅ Broken links detection  
✅ Core Web Vitals (LCP, CLS, INP, TBT)  
✅ Keyboard navigation testing  
✅ Action items s remediation návrhy  

---

## Architektura

### Vysokoúrovňový přehled

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS API Gateway                         │
│                    (REST API endpoint)                       │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Lambda                              │
│                   (handler function)                         │
│                                                              │
│  ┌────────────┐      ┌──────────────┐     ┌──────────────┐ │
│  │  Crawler   │ ───▶ │ WebScanner   │ ───▶│  Reporter    │ │
│  │ (crawl/    │      │ (axe + ACT)  │     │ (JSON/HTML)  │ │
│  │  single)   │      │              │     │              │ │
│  └────────────┘      └──────────────┘     └──────────────┘ │
│                            │                                │
│                            ▼                                │
│                   ┌─────────────────┐                       │
│                   │  Puppeteer +    │                       │
│                   │  @sparticuz/    │                       │
│                   │  chromium       │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                   │                    │
                   ▼                    ▼
         ┌──────────────────┐   ┌──────────────────┐
         │   AWS S3         │   │  AWS DynamoDB    │
         │ (screenshots)    │   │ (scan history)   │
         └──────────────────┘   └──────────────────┘
```

### Struktura projektu

```
a11y-flow/
├── src/
│   ├── index.ts                    # Lambda handler (entry point)
│   ├── globals.d.ts                # TypeScript global types
│   │
│   ├── core/                       # Core scanning logic
│   │   ├── WebScanner.ts          # Main scanner (axe + custom tests)
│   │   ├── Crawler.ts             # Site crawler (BFS)
│   │   ├── types.ts               # TypeScript interfaces (DTOs)
│   │   ├── ActMapper.ts           # Maps axe rules → ACT Rules
│   │   ├── ViolationMapper.ts     # Groups violations by impact
│   │   ├── RemediationService.ts  # Generates fix suggestions
│   │   ├── ScreenshotCapturer.ts  # Screenshots → S3
│   │   ├── SitemapFetcher.ts      # XML sitemap parser
│   │   │
│   │   └── acts/                  # Custom ACT-like tests
│   │       ├── ActRuleRegistry.ts
│   │       ├── CustomActSuite.ts  # Test orchestrator
│   │       ├── FocusOrder.ts      # WCAG 2.1.2, 2.4.3
│   │       ├── SkipLink.ts        # WCAG 2.4.1
│   │       ├── Landmarks.ts       # WCAG 1.3.1
│   │       ├── ModalFocus.ts      # WCAG 2.1.2, 2.4.3
│   │       ├── CarouselAutoplay.ts # WCAG 2.2.2
│   │       ├── AutoplayMedia.ts   # WCAG 1.4.2
│   │       ├── MetaViewport.ts    # WCAG 1.4.4
│   │       ├── OrientationLock.ts # WCAG 1.3.4
│   │       ├── FormErrors.ts      # WCAG 3.3.1, 3.3.3
│   │       └── SuspiciousAltText.ts # WCAG 1.1.1
│   │
│   ├── handlers/                  # AWS Lambda handlers
│   │   ├── ScanScheduler.ts      # EventBridge scheduled scans
│   │   ├── StripeWebhookHandler.ts # Payment webhooks
│   │   └── HistoryHandler.ts     # Scan history API
│   │
│   └── scripts/                   # Deployment & setup
│       ├── build.js              # esbuild bundler
│       ├── deploy.js             # Deploy to AWS Lambda
│       ├── init-aws.js           # AWS infra setup
│       ├── init-db.js            # DynamoDB table creation
│       ├── init-api.js           # API Gateway setup
│       ├── set-stripe-secret.js  # Stripe config
│       ├── verify-act-rules.ts   # Test ACT rules
│       └── rules.json            # ACT Rules registry
│
├── test-pages/rules/             # Test HTML pages for ACT rules
├── dist/                         # Build output (esbuild)
├── generate-html-report.js       # HTML report generator
├── run-local.ts                  # Local Lambda simulation
├── run-local-scan-v2.ts          # Direct WebScanner test
├── run-test-suite.ts             # Run all ACT tests
├── package.json
├── tsconfig.json
└── README.md
```

---

## Klíčové komponenty

### 1. WebScanner (src/core/WebScanner.ts)

**Odpovědnost:** Hlavní scanning engine  

**Metody:**
- `scan(url: string): Promise<AuditReport>` - Single page scan
- `handleCookieConsent(page: Page)` - Auto-dismiss cookie banners
- `configureDeviceProfile(page: Page, device: ScanDevice)` - Viewport setup
- `checkBrokenLinks(page: Page, url: string)` - HTTP 4xx/5xx detection
- `preparePage(page: Page, url: string)` - Screenshots + HTML snapshot

**Workflow:**
1. Launch Puppeteer with @sparticuz/chromium
2. Navigate to URL
3. Dismiss cookie banners (heuristics)
4. Configure viewport (desktop/mobile/tablet)
5. Run axe-core analysis
6. Run custom ACT tests (CustomActSuite)
7. Capture screenshot + HTML
8. Check broken links
9. Generate violations + action items
10. Return AuditReport

**Integrace:**
```typescript
const scanner = new WebScanner();
const report = await scanner.scan('https://example.com');
// report: AuditReport (JSON)
```

---

### 2. CustomActSuite (src/core/acts/CustomActSuite.ts)

**Odpovědnost:** Orchestrace custom ACT testů

**Registrované testy:**
```typescript
const REGISTERED_TESTS = [
  { id: 'focus-order', run: runFocusOrderActTest },
  { id: 'landmarks', run: runLandmarksActTest },
  { id: 'skip-link', run: runSkipLinkActTest },
  { id: 'modal-focus', run: runModalFocusActTest },
  { id: 'carousel-autoplay', run: runCarouselActTest },
  { id: 'autoplay-media', run: runAutoplayMediaActTest },
  { id: 'meta-viewport', run: runMetaViewportActTest },
  { id: 'orientation-lock', run: runOrientationLockActTest },
  { id: 'form-errors', run: runFormErrorsActTest },
  { id: 'suspicious-alt-text', run: runSuspiciousAltTextTest },
];
```

**Výstup:**
```typescript
interface CustomActSuiteResult {
  violations: AccessibilityViolation[];
  actionItems: HumanReadableActionItem[];
  pageDimensions?: { width: number; height: number };
}
```

---

### 3. FocusOrder Test (src/core/acts/FocusOrder.ts)

**Účel:** Detekce keyboard trapů a focus order problémů

**Testované scénáře:**
- ✅ **Keyboard Trap (WCAG 2.1.2)** - Focus loop detection
  - Simuluje 200 TAB kroků
  - Detekuje cykly (návrat na stejný prvek)
  - Impact: `critical`

- ⚠️ **Visual Focus Jump (WCAG 2.4.3)** - Partial coverage
  - Heuristika: delta > 100px mezi po sobě jdoucími prvky
  - Omezení: Nedetekuje všechny logické skoky
  - Impact: `moderate`

- ⚠️ **Modal Focus Bleed** - Partial coverage
  - Detekuje focus úniku z modálů
  - Vyžaduje automatické otevření modalu
  - Impact: `critical`

**Algoritmus:**
```typescript
1. Získej všechny focusable elementy
2. FOR i = 0 to 200:
   - Press Tab
   - Zaznamenej activeElement + pozici
   - Pokud fokus uniká z modalu → violation
   - Pokud delta Y > 100px nahoru → violation
   - Pokud se vrátíme na prvek navštívený před >5 kroky → violation (trap)
3. Return violations
```

**Výstup:**
```typescript
{
  id: 'a11yflow-focus-trap',
  title: 'Klávesnicová past (focus loop)',
  impact: 'critical',
  helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html',
  nodes: [{ html: '...', target: ['#trap-element'] }]
}
```

---

### 4. ActMapper (src/core/ActMapper.ts)

**Odpovědnost:** Mapování axe-core rule IDs → W3C ACT Rules

**Příklad:**
```typescript
// axe rule: 'image-alt'
// → ACT Rule: '23a2a8' (Images have accessible names)
// → URL: https://www.w3.org/WAI/standards-guidelines/act/rules/23a2a8/

const mapping = await ActMapper.getActRuleInfo('image-alt');
// {
//   actRuleIds: ['23a2a8'],
//   actRuleUrls: ['https://www.w3.org/WAI/...']
// }
```

**Registry:** `src/scripts/rules.json` (149 ACT rules)

---

### 5. RemediationService (src/core/RemediationService.ts)

**Odpovědnost:** Generování fix návrhů pro violations

**Příklad:**
```typescript
const fix = RemediationService.getSuggestedFix('image-alt');
// "Přidejte atribut alt s popisným textem pro každý <img> element.
//  Alt text by měl stručně popsat obsah obrázku..."
```

**Kategorie:**
- Images (alt text, decorative images)
- Forms (labels, error messages)
- Color contrast
- Headings structure
- ARIA attributes
- Keyboard navigation
- Focus management

---

### 6. Crawler (src/core/Crawler.ts)

**Odpovědnost:** Procházení celého webu (BFS)

**Metody:**
- `crawl(rootUrl: string, options?): Promise<CrawlSummary>`

**Algoritmus:**
```typescript
1. Start from rootUrl
2. Scan page → extract internal links
3. Add links to queue (BFS)
4. Scan each page (up to maxPages)
5. Return aggregated CrawlSummary
```

**Output:**
```typescript
interface CrawlSummary {
  rootUrl: string;
  totalPagesScanned: number;
  averageScore: number;
  totalCriticalViolations: number;
  totalViolations: number;
  pages: AuditReport[];
  performanceSummary?: { averageLcp, averageCls, ... };
}
```

---

## WCAG & ACT Rules pokrytí

### WCAG 2.1 / 2.2 Pokrytí

| WCAG Kritérium | Level | Pokrytí | Metoda | ID |
|----------------|-------|---------|--------|-----|
| **1.1.1** Non-text Content | A | ✅ Částečné | axe-core + suspicious-alt-text | `image-alt`, `a11yflow-suspicious-alt` |
| **1.3.1** Info and Relationships | A | ✅ Ano | axe-core + landmarks | `heading-order`, `landmark-*` |
| **1.3.4** Orientation | AA | ✅ Ano | orientation-lock | `a11yflow-orientation-lock` |
| **1.4.2** Audio Control | A | ✅ Ano | autoplay-media | `a11yflow-autoplay-media` |
| **1.4.3** Contrast (Minimum) | AA | ✅ Ano | axe-core | `color-contrast` |
| **1.4.4** Resize Text | AA | ✅ Ano | meta-viewport | `a11yflow-meta-viewport` |
| **2.1.2** No Keyboard Trap | A | ✅ Ano | focus-order | `a11yflow-focus-trap` |
| **2.2.2** Pause, Stop, Hide | A | ✅ Ano | carousel-autoplay | `a11yflow-carousel-autoplay` |
| **2.4.1** Bypass Blocks | A | ✅ Ano | skip-link | `a11yflow-skip-link` |
| **2.4.3** Focus Order | A | ⚠️ Částečné | focus-order | `a11yflow-visual-focus-jump` |
| **3.3.1** Error Identification | A | ✅ Ano | form-errors | `a11yflow-form-errors` |
| **3.3.2** Labels or Instructions | A | ✅ Ano | axe-core | `label`, `label-title-only` |
| **4.1.1** Parsing | A | ✅ Ano | axe-core | `duplicate-id-*` |

**Legenda:**
- ✅ Ano - Plné automatické pokrytí
- ⚠️ Částečné - Heuristiky, false positives možné
- ❌ Ne - Vyžaduje manuální audit

### Custom ACT-like Testy

| Test ID | WCAG | ACT Rule | Popis |
|---------|------|----------|-------|
| `focus-order` | 2.1.2, 2.4.3 | b4f0c3 | Keyboard traps, focus jumps |
| `skip-link` | 2.4.1 | - | Skip to main content link |
| `landmarks` | 1.3.1 | - | ARIA landmarks (main, nav, ...) |
| `modal-focus` | 2.1.2, 2.4.3 | - | Modal focus management |
| `carousel-autoplay` | 2.2.2 | - | Auto-rotating carousels |
| `autoplay-media` | 1.4.2 | - | Auto-playing audio/video |
| `meta-viewport` | 1.4.4 | b4f0c3 | Viewport zoom restrictions |
| `orientation-lock` | 1.3.4 | - | CSS orientation locks |
| `form-errors` | 3.3.1, 3.3.3 | - | Form error identification |
| `suspicious-alt-text` | 1.1.1 | 23a2a8 | Generic alt texts (e.g., "image.jpg") |

---

## Datové struktury

### AuditReport (Core Output)

```typescript
interface AuditReport {
  url: string;
  timestamp: string;  // ISO 8601
  score: number;      // 0-100 (100 = no violations)
  
  // Optional captures
  fullPageScreenshot?: string;  // Base64 JPEG
  htmlSnapshot?: string;        // Full DOM HTML
  pageDimensions?: { width: number; height: number };
  
  // Metadata
  meta: {
    browserVersion: string;     // e.g., "Chrome/120.0.0.0"
    engineVersion: string;      // e.g., "axe-core 4.8.3"
  };
  
  // Violations grouped by impact
  violations: {
    critical: AccessibilityViolation[];
    serious: AccessibilityViolation[];
    moderate: AccessibilityViolation[];
    minor: AccessibilityViolation[];
  };
  
  // Statistics
  stats: {
    totalViolations: number;
    criticalCount: number;
  };
  
  // Human-readable action items
  humanReadable: HumanReadableReport;
  
  // Optional features
  brokenLinks?: BrokenLinksSummary;
  performance?: PerformanceReport;
  keyboardNavigation?: KeyboardNavigationReport;
}
```

### AccessibilityViolation

```typescript
interface AccessibilityViolation {
  id: string;              // e.g., "image-alt", "a11yflow-focus-trap"
  title: string;           // Human-readable title
  description: string;     // What's wrong
  impact: ImpactLevel;     // "critical" | "serious" | "moderate" | "minor"
  helpUrl?: string;        // Link to WCAG docs
  count: number;           // Number of affected elements
  suggestedFix?: string;   // How to fix
  
  // ACT Rules mapping
  actRuleIds?: string[];   // e.g., ["23a2a8"]
  actRuleUrls?: string[];  // Links to ACT Rules
  
  // Affected elements
  nodes: ViolationNode[];
}

interface ViolationNode {
  html: string;            // Element HTML snippet
  target: string[];        // CSS selectors
  failureSummary: string;  // Why it failed
  screenshotUrl?: string;  // S3 URL (if enabled)
  elementLabel?: string;   // e.g., "Button 'Submit' in form"
  fingerprint?: string;    // Stable identifier
}
```

### HumanReadableActionItem

```typescript
interface HumanReadableActionItem {
  id: string;                 // Rule ID
  impact: ImpactLevel;
  priority: HumanReadablePriority; // "🔴 Critical" | "🟠 Serious" | ...
  category: HumanReadableCategory; // "Forms" | "Navigation" | ...
  
  what: string;               // Problem description
  fix: string;                // Fix instructions
  
  exampleUrl: string;         // Where it occurs
  exampleTarget?: string;     // CSS selector
  
  wcagReference?: string;     // "2.4.3 Focus Order"
  actRuleIds?: string[];
  actRuleUrls?: string[];
  
  technicalSummary?: string;
  elementLabel?: string;
  fingerprint?: string;
  componentName?: string;     // e.g., "PrimaryButton"
}
```

---

## Workflow

### 1. Single Page Scan

```typescript
// AWS Lambda Event
{
  body: JSON.stringify({
    url: 'https://example.com',
    mode: 'single',
    device?: 'desktop' | 'mobile' | 'tablet'
  }),
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
}

// Lambda Response
{
  statusCode: 200,
  body: JSON.stringify(auditReport) // AuditReport object
}
```

### 2. Crawl Mode

```typescript
// Request
{
  body: JSON.stringify({
    url: 'https://example.com',
    mode: 'crawl',
    maxPages: 10,
    device: 'desktop'
  })
}

// Response
{
  statusCode: 200,
  body: JSON.stringify(crawlSummary) // CrawlSummary object
}
```

### 3. Local Testing

```bash
# Direct WebScanner test
npx ts-node run-local-scan-v2.ts

# Lambda handler simulation
npx ts-node run-local.ts https://example.com

# ACT Rules test suite
npx ts-node run-test-suite.ts
```

### 4. Report Generation

```bash
# Generate HTML report
node generate-html-report.js report-123456.json
# → report-123456.html
```

---

## Deployment

### Build Process

```bash
npm run build
# → esbuild bundles to dist/index.js (single file)
```

**esbuild config:**
- Platform: `node`
- Target: `node20`
- Format: `cjs`
- Bundle: `true`
- External: `@sparticuz/chromium`
- Minify: `false` (for debugging)

### Deploy to AWS

```bash
npm run deploy
# → Creates Lambda deployment package
# → Uploads to AWS Lambda
# → Updates function code
```

**Lambda Configuration:**
- Runtime: Node.js 20.x
- Memory: 2048 MB (minimum for Chromium)
- Timeout: 300s (5 minutes)
- Ephemeral storage: 2048 MB
- Environment variables:
  - `A11Y_API_KEY` - API authentication
  - `AWS_S3_BUCKET` - Screenshots bucket
  - `DYNAMODB_TABLE_NAME` - Scan history table
  - `STRIPE_SECRET_KEY` - Payment integration

### AWS Infrastructure Setup

```bash
# 1. Create DynamoDB table
npm run init-db

# 2. Setup AWS resources (S3, IAM)
npm run init-aws

# 3. Create API Gateway
npm run init-api

# 4. Set Stripe secret (if using payments)
npm run set-stripe-secret
```

---

## Testování

### Test Pages (test-pages/rules/)

HTML test stránky pro každé ACT pravidlo:

| File | WCAG | Test |
|------|------|------|
| `alt-text.html` | 1.1.1 | Missing alt attributes |
| `autoplay.html` | 1.4.2 | Auto-playing media |
| `carousel.html` | 2.2.2 | Auto-rotating carousel |
| `focus-order.html` | 2.1.2, 2.4.3 | Keyboard trap |
| `forms.html` | 3.3.1, 3.3.2 | Form labels & errors |
| `landmarks.html` | 1.3.1 | Missing landmarks |
| `meta-viewport.html` | 1.4.4 | Viewport restrictions |
| `modal.html` | 2.1.2 | Modal focus trap |
| `orientation.html` | 1.3.4 | Orientation lock |
| `skip-link.html` | 2.4.1 | Missing skip link |

### Running Tests

```bash
# Test all ACT rules
npx ts-node run-test-suite.ts
# → Starts local server
# → Scans each test page
# → Verifies expected violations

# Verify ACT Rules mapping
npm run verify-rules
```

---

## Současný stav

### ✅ Hotové

**Core Functionality:**
- ✅ WebScanner s axe-core integrací
- ✅ 10 custom ACT-like testů
- ✅ FocusOrder test (keyboard traps detection)
- ✅ ActMapper s 149 ACT Rules
- ✅ RemediationService s fix návrhy
- ✅ HTML report generator
- ✅ Screenshot capture + S3 upload
- ✅ Broken links detection
- ✅ Core Web Vitals metrics
- ✅ Crawler (multi-page scan)
- ✅ AWS Lambda deployment
- ✅ API Gateway integration
- ✅ DynamoDB scan history
- ✅ Stripe webhooks (payments)

**Documentation:**
- ✅ README.md
- ✅ Inline TypeScript dokumentace
- ✅ Test pages s očekávanými violations
- ✅ AI_CONTEXT.md (tento soubor)

**Code Quality:**
- ✅ TypeScript strict mode
- ✅ Čistý kód bez dead code
- ✅ 33 zdrojových souborů
- ✅ Modulární architektura

### ⚠️ Omezení & Known Issues

**FocusOrder Test:**
- ✅ Keyboard trap detection funguje správně
- ⚠️ Visual focus jump: heuristika delta >100px nedetekuje všechny případy
- ⚠️ Modal focus bleed: vyžaduje automatické otevření modalu

**Obecné limity automatizace:**
- ⚠️ ~30-50% WCAG pokrytí (industry standard)
- ⚠️ False positives možné (zejména semantic rules)
- ⚠️ Vyžaduje doplnění manuálním auditem

**Performance:**
- ✅ Single page scan: ~10-30s
- ⚠️ Crawl mode: ~5-10s per page (memory intensive)

### 🚀 Možná rozšíření

**Priorita 1 (High Value):**
1. **Improved Focus Order Detection**
   - Lepší heuristiky pro visual jumps
   - Detekce tabindex misuse
   - DOM vs visual order validation

2. **Modal Detection**
   - Automatická detekce modálů na stránce
   - Test focus trap před i po otevření
   - ARIA attributes validation

3. **Form Testing**
   - Submit simulation
   - Error message triggering
   - Real-time validation testing

**Priorita 2 (Nice to Have):**
4. **Screenshot Annotations**
   - Zvýraznění problematických prvků
   - Visual markers na screenshot

5. **PDF Report Generator**
   - Manager-friendly PDF export
   - Graphs & charts

6. **Historical Comparison**
   - Diff between scans
   - Trend analysis
   - Regression detection

7. **ARIA Validation**
   - Expanded ARIA patterns testing
   - Widget behavior validation

---

## API Reference

### Lambda Handler

**Endpoint:** `POST https://api.example.com/scan`

**Headers:**
```json
{
  "x-api-key": "YOUR_API_KEY",
  "Content-Type": "application/json"
}
```

**Request Body (Single Scan):**
```json
{
  "url": "https://example.com",
  "mode": "single",
  "device": "desktop",
  "captureScreenshot": true,
  "checkBrokenLinks": true
}
```

**Request Body (Crawl):**
```json
{
  "url": "https://example.com",
  "mode": "crawl",
  "maxPages": 10,
  "device": "desktop"
}
```

**Response (Success):**
```json
{
  "statusCode": 200,
  "body": "{...AuditReport or CrawlSummary...}"
}
```

**Response (Error):**
```json
{
  "statusCode": 500,
  "body": "{\"error\": \"Failed to scan URL: ...\"}"
}
```

---

## Důležité soubory pro AI

**Pro pochopení architektury:**
1. `src/index.ts` - Lambda entry point
2. `src/core/WebScanner.ts` - Core logic
3. `src/core/types.ts` - All TypeScript interfaces
4. `src/core/acts/CustomActSuite.ts` - ACT tests orchestration

**Pro úpravy ACT testů:**
1. `src/core/acts/FocusOrder.ts` - Focus testing
2. `src/core/acts/ModalFocus.ts` - Modal testing
3. `src/core/acts/FormErrors.ts` - Form testing

**Pro deployment:**
1. `src/scripts/build.js` - Build config
2. `src/scripts/deploy.js` - AWS deployment
3. `package.json` - Dependencies & scripts

**Pro testování:**
1. `run-test-suite.ts` - ACT rules tests
2. `test-pages/rules/*.html` - Test fixtures

---

## Kontakt & Poznámky

**Současná verze:** 1.0.0 (Production Ready)  
**Poslední update:** 3. ledna 2026  
**Status:** ✅ Vyčištěno, refaktorováno, ready for next iteration  

**Pro AI asistenta:**
- Kód je v TypeScript strict mode
- Používáme async/await (žádné callbacky)
- Error handling: try-catch s logováním do CloudWatch
- Console.log/warn/error je OK (jde do AWS CloudWatch)
- Bundle size: ~2.5 MB (včetně dependencies)
- Cold start: ~3-5s (chromium loading)
- Warm start: <1s

**Konvence:**
- File names: PascalCase.ts pro classes, kebab-case.html pro HTML
- Funkce: camelCase
- Konstanty: UPPER_SNAKE_CASE
- Interfaces: PascalCase, prefix 'I' není použit
- Commit messages: conventional commits preferováno

---

## Changelog

### v1.0.0 (2026-01-03)
- ✅ Initial production release
- ✅ Vyčištěn dead code
- ✅ Odstraněny focus path vizualizace
- ✅ Refactored FocusOrder test
- ✅ 10 custom ACT tests
- ✅ HTML report generator
- ✅ AWS Lambda deployment ready

---

**Konec dokumentace** 🎉
