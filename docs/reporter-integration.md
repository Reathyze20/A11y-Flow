# Použití SPA & Shadow DOM metadat v reportech

## Automatická detekce v reportech

### 1. HTML Report (generate-html-report.js)

V HTML reportu se nyní automaticky zobrazí SPA a Shadow DOM metadata v sekci shrnutí:

#### SPA Framework

```javascript
// Zobrazí se pokud je detekován SPA framework
{
  spaMetadata: {
    detectedFramework: 'react' | 'vue' | 'angular' | 'unknown',
    hasClientSideRouting: boolean,
    hydrationTime: number,  // ms
    stabilityTime: number   // ms
  }
}
```

**Zobrazení v reportu:**
```
⚛️ SPA Framework
React
[Client-side routing]
Hydration: 450ms · Stability: 823ms
```

#### Shadow DOM

```javascript
// Zobrazí se pokud je detekován Shadow DOM
{
  shadowDOMMetadata: {
    hasShadowDOM: true,
    shadowHostCount: 5,
    closedShadowRoots: 0,
    webComponents: ['custom-button', 'custom-card', ...]
  }
}
```

**Zobrazení v reportu:**
```
🎯 Shadow DOM
5 shadow roots
3 web components
<custom-button>, <custom-card>, <custom-form>
```

### 2. Diff Report (Differ.ts)

V diff reportech pro PR checks se metadata zobrazí v sekci "Technical Details":

```markdown
### 🔧 Technical Details
- **Framework:** ⚛️ React
- **Routing:** Client-side
- **Hydration Time:** 450ms
- **Page Stability:** 823ms
- **Shadow DOM:** 5 shadow root(s)
- **Web Components:** custom-button, custom-card, custom-form
- ⚠️ **Warning:** 1 closed shadow root(s) could not be scanned
```

## Jak spustit test

### 1. Test lokální stránky

```bash
# Spustit test s SPA/Shadow DOM detekcí
ts-node test-spa-shadow.ts
```

Očekávaný výstup:
```
✅ Test server started at http://localhost:8080

🧪 Testing SPA Scanning...
[SPAHandler] Detected framework: react
[SPAHandler] Page stable after 823ms

📊 SPA Scan Results
   Total violations: 15

🧪 Testing Shadow DOM Scanning...
[ShadowDOMScanner] Found and prepared 5 shadow root(s)

📊 Shadow DOM Scan Results
   Total violations: 12
```

### 2. Vygenerovat HTML report

```bash
# Naskenovat stránku
node dist/index.js --scan http://localhost:8080/spa.html

# Vygenerovat HTML report
node generate-html-report-v2.js test-report.json
```

HTML report obsahuje:
- ✅ SPA Framework section (pokud detekováno)
- ✅ Shadow DOM section (pokud detekováno)  
- ✅ Barevné badges pro routing a warnings
- ✅ Seznam web components

### 3. Diff Analysis s metadaty

```bash
# Naskenovat baseline
node dist/index.js --scan https://prod.com --output baseline.json

# Naskenovat current
node dist/index.js --scan https://preview.com --output current.json

# Vygenerovat diff
node bin/cli.js diff baseline.json current.json -o diff.md -f markdown
```

Diff markdown obsahuje:
- Standardní sekce (New Issues, Fixed, Summary)
- **NOVĚ:** 🔧 Technical Details section s SPA/Shadow DOM metadata

## Příklad úplného workflow

```bash
# 1. Build projekt
npm run build

# 2. Spustit test SPA/Shadow DOM
ts-node test-spa-shadow.ts

# 3. Naskenovat reálnou aplikaci
node dist/index.js --scan https://your-react-app.com --output current-scan.json

# 4. Vygenerovat HTML report
node generate-html-report.js current-scan.json

# 5. Otevřít report v prohlížeči
# - Vidíš ⚛️ React framework v summary
# - Vidíš hydration/stability times
# - Pokud máš web components, vidíš je také
```

## JSON Struktura

### Kompletní AuditReport s metadaty

```json
{
  "url": "https://your-app.com",
  "score": 85,
  "violations": { ... },
  
  "spaMetadata": {
    "detectedFramework": "react",
    "hasClientSideRouting": true,
    "hydrationTime": 450,
    "stabilityTime": 823
  },
  
  "shadowDOMMetadata": {
    "hasShadowDOM": true,
    "shadowHostCount": 5,
    "closedShadowRoots": 0,
    "webComponents": [
      "custom-button",
      "custom-card",
      "custom-form"
    ]
  }
}
```

## Použití v CI/CD

### GitHub Actions

```yaml
- name: Scan PR preview
  run: |
    node dist/index.js --scan ${{ env.PREVIEW_URL }} --output current.json

- name: Generate diff
  run: |
    node bin/cli.js diff baseline.json current.json -o diff.md -f markdown

- name: Comment PR
  uses: actions/github-script@v6
  with:
    script: |
      const fs = require('fs');
      const markdown = fs.readFileSync('diff.md', 'utf8');
      github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: markdown
      });
```

PR comment bude obsahovat:
```markdown
## 🎯 Accessibility Changes

### ✅ Improvements (3)
- Fixed: Missing alt text on images

### ⚠️ New Issues (2)
- Button without accessible name

### 📊 Summary
- **Before:** 15 issues (Score: 82)
- **After:** 14 issues (Score: 85)
- **Net Change:** ✅ +1 (improved)
- **Score Change:** +3.0 points

### 🔧 Technical Details
- **Framework:** ⚛️ React
- **Routing:** Client-side
- **Hydration Time:** 450ms
- **Page Stability:** 823ms
- **Shadow DOM:** 5 shadow root(s)
- **Web Components:** custom-button, custom-card, custom-form
```

## Programmatic API

```typescript
import { WebScanner } from './src/core/WebScanner';
import { AccessibilityDiffer } from './src/core/Differ';

// Scan with metadata collection
const scanner = new WebScanner();
const report = await scanner.scan('https://your-app.com');

// Metadata je automaticky součástí reportu
if (report.spaMetadata) {
  console.log(`Framework: ${report.spaMetadata.detectedFramework}`);
  console.log(`Hydration: ${report.spaMetadata.hydrationTime}ms`);
}

if (report.shadowDOMMetadata) {
  console.log(`Shadow roots: ${report.shadowDOMMetadata.shadowHostCount}`);
  console.log(`Components: ${report.shadowDOMMetadata.webComponents.join(', ')}`);
}

// Diff s metadaty
const differ = new AccessibilityDiffer();
const diff = differ.diff(baseline, report);
const markdown = differ.formatAsMarkdown(diff, report, {
  includeDetails: true,
  reportUrl: 'https://reports.com/123'
});

console.log(markdown); // Obsahuje Technical Details section
```

## Customizace HTML reportu

Pokud chceš upravit zobrazení, edituj funkce v `generate-html-report.js`:

```javascript
// Přidat vlastní badge
function buildSPAMetadataHtml(report) {
  const spa = report.spaMetadata;
  if (!spa) return '';
  
  // Vlastní logika
  const isPerformant = spa.hydrationTime < 500;
  const badge = isPerformant ? 
    '<span class="badge badge-success">Fast</span>' :
    '<span class="badge badge-warning">Slow</span>';
  
  return `...${badge}...`;
}
```

## Checklist

- [x] ✅ SPA metadata se sbírá automaticky
- [x] ✅ Shadow DOM metadata se sbírá automaticky  
- [x] ✅ HTML report zobrazuje metadata
- [x] ✅ Diff report obsahuje Technical Details
- [x] ✅ JSON obsahuje kompletní strukturu
- [x] ✅ Test pages fungují (spa.html, shadow-dom.html)
- [x] ✅ CI/CD integrace ready

## Troubleshooting

### "Metadata chybí v reportu"

**Příčina**: Stránka není SPA nebo nemá Shadow DOM

**Řešení**: Metadata se zobrazí pouze když jsou detekovány. Zkontroluj:
```bash
# Otevři JSON report
cat report.json | jq '.spaMetadata, .shadowDOMMetadata'
```

### "Framework not detected"

**Příčina**: Obfuskovaný kód nebo SSR

**Řešení**: Scanner stále funguje, jen neukáže framework name. Stability detection funguje vždy.

### "Closed shadow roots warning"

**Příčina**: Web components používají `mode: 'closed'`

**Řešení**: Změň na `mode: 'open'` nebo přijmi, že closed roots nelze skenovat.

## Další informace

- [SPA/Shadow DOM dokumentace](./docs/spa-shadow-dom.md)
- [Diff Analysis guide](./examples/README.md)
- [GitHub Actions template](./.github/workflows/a11y-check.yml)
