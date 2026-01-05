# ✅ SPA & Shadow DOM v Reportech - Kompletní implementace

## Co bylo přidáno

### 1. Typy (src/core/types.ts)

```typescript
// Nové metadata v AuditReport
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
```

### 2. WebScanner integrace (src/core/WebScanner.ts)

Scanner nyní automaticky sbírá metadata:

```typescript
// SPA detection
const detectedFramework = await SPAHandler.detectFramework(page);
const hasClientSideRouting = await SPAHandler.hasClientSideRouting(page);
await SPAHandler.waitForSPAReady(page, 'auto', 10000);
const hydrationTime = Date.now() - spaStartTime;

// Shadow DOM detection  
const hasShadowDOM = await ShadowDOMScanner.hasShadowDOM(page);
const hosts = await ShadowDOMScanner.getShadowHosts(page);
const webComponents = await ShadowDOMScanner.detectWebComponents(page);

// Přidání do reportu
if (detectedFramework || hasClientSideRouting) {
  report.spaMetadata = { ... };
}

if (hasShadowDOM) {
  report.shadowDOMMetadata = { ... };
}
```

### 3. HTML Reporter (generate-html-report.js)

**Nové funkce:**

```javascript
// Zobrazí SPA framework info
function buildSPAMetadataHtml(report) {
  // ⚛️ React
  // [Client-side routing]
  // Hydration: 450ms · Stability: 823ms
}

// Zobrazí Shadow DOM info
function buildShadowDOMMetadataHtml(report) {
  // 🎯 Shadow DOM
  // 5 shadow roots
  // 3 web components [1 closed]
  // <custom-button>, <custom-card>, <custom-form>
}
```

**CSS badges:**
```css
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; }
.badge-success { background: #e8f5e9; color: #2e7d32; }
.badge-warning { background: #fff3e0; color: #ef6c00; }
.badge-neutral { background: #f5f5f5; color: #666; }
```

### 4. Diff Reporter (src/core/Differ.ts)

**Nová metoda:**

```typescript
private addTechnicalMetadataToMarkdown(
  markdown: string, 
  diff: DiffResult, 
  currentReport: AuditReport
): string {
  // Přidá sekci:
  // ### 🔧 Technical Details
  // - Framework: ⚛️ React
  // - Routing: Client-side
  // - Hydration Time: 450ms
  // - Shadow DOM: 5 shadow root(s)
  // - Web Components: custom-button, custom-card
  // - ⚠️ Warning: 1 closed shadow root(s)
}
```

**Signature change:**
```typescript
// Před: formatAsMarkdown(diff, options)
// Po:   formatAsMarkdown(diff, currentReport, options)
```

### 5. CLI (bin/cli.js)

Diff command nyní předává current report:

```javascript
const markdown = differ.formatAsMarkdown(diff, current, {
  includeDetails: true,
  reportUrl: options.reportUrl
});
```

## Jak použít

### A. Automaticky (doporučeno)

```typescript
import { WebScanner } from './src/core/WebScanner';

const scanner = new WebScanner();
const report = await scanner.scan('https://your-app.com');

// Metadata jsou automaticky součástí reportu
console.log(report.spaMetadata);
console.log(report.shadowDOMMetadata);
```

### B. HTML Report

```bash
# 1. Scan
node dist/index.js --scan http://your-app.com --output report.json

# 2. Generate HTML
node generate-html-report-v2.js report.json

# Report obsahuje:
# - SPA Framework box (pokud detekováno)
# - Shadow DOM box (pokud detekováno)
# - Barevné badges
```

### C. Diff Report

```bash
# Generate diff with metadata
node bin/cli.js diff baseline.json current.json -o diff.md -f markdown

# diff.md obsahuje:
# - Standardní sekce (New Issues, Fixed, Summary)
# - NOVOU sekci: 🔧 Technical Details
```

### D. Custom Reporter

```typescript
import { analyzeTechStack, generateCustomReport } from './examples/custom-reporter-with-metadata';

const report = await scanner.scan('...');

// Analýza tech stacku
const tech = analyzeTechStack(report);
// { type: 'Modern SPA with Web Components', complexity: 'High', ... }

// Custom report format
const custom = generateCustomReport(report);
// { meta, technology, accessibility, recommendations }
```

## Příklad výstupu

### HTML Report Summary

```
╔═══════════════════════════════════╗
║ ⚛️ SPA Framework                  ║
║ React                             ║
║ [Client-side routing]             ║
║ Hydration: 450ms · Stability: 823ms║
╠═══════════════════════════════════╣
║ 🎯 Shadow DOM                     ║
║ 5 shadow roots                    ║
║ 3 web components [1 closed]      ║
║ <custom-button>, <custom-card>    ║
╚═══════════════════════════════════╝
```

### Diff Markdown

```markdown
## 🎯 Accessibility Changes

### ✅ Improvements (3)
...

### 📊 Summary
- **Before:** 15 issues (Score: 82)
- **After:** 12 issues (Score: 87)
- **Net Change:** ✅ +3 (improved)

### 🔧 Technical Details
- **Framework:** ⚛️ React
- **Routing:** Client-side
- **Hydration Time:** 450ms
- **Page Stability:** 823ms
- **Shadow DOM:** 5 shadow root(s)
- **Web Components:** custom-button, custom-card, custom-form
- ⚠️ **Warning:** 1 closed shadow root(s) could not be scanned
```

### JSON Report

```json
{
  "url": "https://your-app.com",
  "score": 87,
  
  "spaMetadata": {
    "detectedFramework": "react",
    "hasClientSideRouting": true,
    "hydrationTime": 450,
    "stabilityTime": 823
  },
  
  "shadowDOMMetadata": {
    "hasShadowDOM": true,
    "shadowHostCount": 5,
    "closedShadowRoots": 1,
    "webComponents": [
      "custom-button",
      "custom-card",
      "custom-form"
    ]
  },
  
  "violations": { ... }
}
```

## Use Cases

### 1. Performance Monitoring

```typescript
// Track hydration performance over time
const reports = await scanMultipleTimes();
const hydrationTimes = reports.map(r => r.spaMetadata?.hydrationTime);

if (hydrationTimes.some(t => t > 1000)) {
  alert('Hydration regression detected!');
}
```

### 2. Web Component Inventory

```typescript
// List all web components across pages
const allComponents = new Set();
for (const report of crawlResults.pages) {
  report.shadowDOMMetadata?.webComponents.forEach(c => allComponents.add(c));
}

console.log(`Total web components: ${allComponents.size}`);
```

### 3. Technology Stack Report

```typescript
// Generate tech stack overview
const techReport = {
  framework: report.spaMetadata?.detectedFramework,
  routing: report.spaMetadata?.hasClientSideRouting ? 'SPA' : 'MPA',
  webComponents: report.shadowDOMMetadata?.hasShadowDOM,
  componentCount: report.shadowDOMMetadata?.webComponents.length || 0,
};
```

### 4. CI/CD Quality Gates

```typescript
// Fail build on closed shadow roots
if (report.shadowDOMMetadata?.closedShadowRoots > 0) {
  throw new Error(`${report.shadowDOMMetadata.closedShadowRoots} closed shadow roots detected!`);
}

// Warn on slow hydration
if (report.spaMetadata?.hydrationTime > 1000) {
  console.warn('⚠️ Slow hydration detected');
}
```

## Soubory vytvořené/upravené

### Nové soubory
- `docs/reporter-integration.md` - Kompletní dokumentace
- `examples/custom-reporter-with-metadata.ts` - Příklady použití

### Upravené soubory
1. **src/core/types.ts** - Přidány `spaMetadata` a `shadowDOMMetadata` do `AuditReport`
2. **src/core/WebScanner.ts** - Sběr metadata během scanu
3. **src/core/SPAHandler.ts** - `detectFramework()` změněna na public
4. **src/core/Differ.ts** - Přidána `addTechnicalMetadataToMarkdown()`, změněna signature `formatAsMarkdown()`
5. **generate-html-report.js** - Přidány `buildSPAMetadataHtml()` a `buildShadowDOMMetadataHtml()`
6. **bin/cli.js** - Předávání current reportu do `formatAsMarkdown()`

## Status

✅ **Build successful:** npm run build - 0 errors  
✅ **Types updated:** AuditReport interface extended  
✅ **Scanner collects:** SPA + Shadow DOM metadata  
✅ **HTML reporter shows:** Both metadata types with badges  
✅ **Diff reporter shows:** Technical Details section  
✅ **CLI updated:** Passes current report to differ  
✅ **Examples created:** Custom reporter usage  
✅ **Documentation:** Complete integration guide  

## Next Steps

1. **Test HTML report:**
   ```bash
   ts-node test-spa-shadow.ts
   node generate-html-report.js test-report.json
   open test-report.html
   ```

2. **Test diff report:**
   ```bash
   node bin/cli.js diff baseline.json current.json -o diff.md -f markdown
   cat diff.md
   ```

3. **CI/CD Integration:**
   - Použij `.github/workflows/a11y-check.yml` template
   - PR comments budou obsahovat Technical Details

4. **Custom reporting:**
   - Použij `examples/custom-reporter-with-metadata.ts` jako základ
   - Vytvoř vlastní formát podle potřeby

## Dokumentace

- **Integrace do reportů:** [docs/reporter-integration.md](docs/reporter-integration.md)
- **SPA/Shadow DOM základy:** [docs/spa-shadow-dom.md](docs/spa-shadow-dom.md)
- **Příklady použití:** [examples/custom-reporter-with-metadata.ts](examples/custom-reporter-with-metadata.ts)
- **Quick Reference:** [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
