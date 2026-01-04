# A11y-Flow - Product Roadmap TODO List

> **Status:** Tech-Demo → Production Product  
> **Focus:** Monetizace + Minimalizace provozní režie  
> **Datum:** 3. ledna 2026

---

## 🎯 Fáze 1: Vizuální Srozumitelnost (The "Wow" Factor)

**Cíl:** Aby report pochopila i babička provozující e-shop s vlnou.

### 📸 1.1 Screenshot Annotator
**Priorita:** 🔴 HIGH  
**Business Value:** Okamžitá vizualizace "kde hoří"  
**Effort:** ~4-8 hodin

#### Implementační kroky:

- [ ] **1.1.1** Rozhodnout knihovnu pro image processing
  - Varianta A: `jimp` (pure JS, no native deps, pomalejší)
  - Varianta B: `sharp` (rychlejší, vyžaduje Lambda Layer)
  - **Doporučení:** Start s `jimp`, později přejít na `sharp` při škálování

- [ ] **1.1.2** Vytvořit `ScreenshotAnnotator.ts` třídu
  - Metoda: `annotateScreenshot(screenshot: Buffer, violations: AccessibilityViolation[]): Promise<Buffer>`
  - Input: Base64 screenshot z `fullPageScreenshot`
  - Output: Annotovaný screenshot jako Buffer

- [ ] **1.1.3** Implementovat bounding box detection
  - V `WebScanner.preparePage()` po axe-core analýze
  - Pro každý `violation.nodes[].target[]`:
    ```typescript
    const element = await page.$(target);
    const box = await element?.boundingBox();
    // Uložit box do violation.nodes[i].boundingBox
    ```

- [ ] **1.1.4** Vykreslit anotace na screenshot
  - Poloprůhledný červený obdélník (`rgba(220, 38, 38, 0.3)`)
  - Číslo chyby v rohu (white text, red background)
  - Pouze `critical` a `serious` violations
  - Numerické označení: 1, 2, 3...

- [ ] **1.1.5** Upravit types.ts
  ```typescript
  interface ViolationNode {
    // ... existing fields
    boundingBox?: { x: number; y: number; width: number; height: number };
    annotationNumber?: number; // Pro reference v reportu
  }
  
  interface AuditReport {
    // ... existing fields
    annotatedScreenshot?: string; // Base64 annotated screenshot
  }
  ```

- [ ] **1.1.6** Integrovat do WebScanner workflow
  - Po `preparePage()` a před návratem reportu
  - Volat `ScreenshotAnnotator.annotateScreenshot()`
  - Uložit do `report.annotatedScreenshot`

- [ ] **1.1.7** Upload na S3 (volitelné)
  - Pokud S3 enabled, upload `screenshot-annotated-{timestamp}.jpg`
  - URL do `report.annotatedScreenshotUrl`

- [ ] **1.1.8** Aktualizovat HTML report generator
  - Přidat zobrazení annotated screenshot
  - Legend: čísla → violations mapping
  - Click na číslo → scroll k violation detailu

**Dependencies:**
```bash
npm install jimp @types/jimp
# nebo
npm install sharp @types/sharp
```

**Test:**
- Scan stránku s 5+ critical violations
- Verify: Screenshot má červené boxy
- Verify: Čísla odpovídají violations v reportu

---

### 📄 1.2 PDF Export pro Agentury
**Priorita:** 🟡 MEDIUM  
**Business Value:** White-label reports, monetizace  
**Effort:** ~2-4 hodiny

#### Implementační kroky:

- [ ] **1.2.1** Vytvořit `PDFGenerator.ts` service
  ```typescript
  class PDFGenerator {
    async generatePDF(reportData: AuditReport): Promise<Buffer> {
      // Use existing Puppeteer instance
      const browser = await puppeteer.launch(...);
      const page = await browser.newPage();
      
      // Render HTML report
      const html = generateHTMLReport(reportData);
      await page.setContent(html);
      
      // Generate PDF
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
      });
      
      return pdf;
    }
  }
  ```

- [ ] **1.2.2** Vytvořit Lambda handler `generatePDFHandler.ts`
  - Input: `{ reportId: string }`
  - Načíst report z DynamoDB
  - Generate PDF
  - Upload na S3
  - Return: `{ pdfUrl: string }`

- [ ] **1.2.3** Přidat PDF-friendly CSS do HTML reportu
  ```css
  @media print {
    .no-print { display: none; }
    .page-break { page-break-before: always; }
  }
  ```

- [ ] **1.2.4** Vytvořit API endpoint `/report/{id}/pdf`
  - Method: `POST`
  - Auth: Check user tier (Pro Plan only)
  - Response: PDF download or S3 URL

- [ ] **1.2.5** Přidat do DynamoDB schema
  ```typescript
  interface ScanRecord {
    // ... existing fields
    pdfGenerated?: boolean;
    pdfUrl?: string;
    pdfGeneratedAt?: string;
  }
  ```

- [ ] **1.2.6** Monetizace gate
  - Check `user.plan === 'pro'` nebo `user.pdfCredits > 0`
  - Decrement credits po generování
  - Error 402 Payment Required if insufficient

- [ ] **1.2.7** Update pricing page
  - Free: ❌ PDF Export
  - Pro: ✅ Unlimited PDF Exports

**Test:**
- Generate PDF z existujícího reportu
- Verify: Formatting je správný
- Verify: Screenshots jsou v PDF
- Verify: Free tier dostane 402 error

---

## 🚀 Fáze 2: Virální Růst (Let them market for you)

### 🏅 2.1 Dynamic Accessibility Badges
**Priorita:** 🟢 HIGH (Low effort / High impact)  
**Business Value:** Virální marketing, backlinks  
**Effort:** ~3-5 hodin

#### Implementační kroky:

- [ ] **2.1.1** Vytvořit `BadgeService.ts`
  ```typescript
  class BadgeService {
    generateSVG(score: number, domain: string): string {
      const color = this.getColorFromScore(score);
      const emoji = this.getEmojiFromScore(score);
      
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="180" height="20">
          <rect fill="${color}" width="180" height="20" rx="3"/>
          <text x="10" y="14" fill="white" font-size="11">
            ${emoji} Accessibility | ${score}/100
          </text>
        </svg>
      `;
    }
    
    private getColorFromScore(score: number): string {
      if (score >= 90) return '#10b981'; // Green
      if (score >= 70) return '#f59e0b'; // Orange
      return '#ef4444'; // Red
    }
    
    private getEmojiFromScore(score: number): string {
      if (score >= 90) return '🟢';
      if (score >= 70) return '🟠';
      return '🔴';
    }
  }
  ```

- [ ] **2.1.2** Vytvořit Lambda handler `badgeHandler.ts`
  - Endpoint: `GET /badge/{domainHash}.svg`
  - domainHash: `crypto.createHash('sha256').update(domain).digest('hex').slice(0, 16)`
  - Fetch latest scan pro domain z DynamoDB
  - Generate SVG
  - Response: `Content-Type: image/svg+xml`, Cache-Control: `max-age=3600`

- [ ] **2.1.3** DynamoDB index pro badge lookup
  ```typescript
  GSI: 'domain-timestamp-index'
  PartitionKey: domainHash
  SortKey: timestamp (DESC)
  ```

- [ ] **2.1.4** Badge embed code generator
  - V HTML reportu přidat sekci "Share Your Score"
  ```html
  <div class="badge-embed">
    <h3>Display your accessibility score:</h3>
    <textarea readonly>
      <a href="https://a11yflow.com/report/{reportId}">
        <img src="https://api.a11yflow.com/badge/{domainHash}.svg" 
             alt="Accessibility Score">
      </a>
    </textarea>
    <button onclick="copyToClipboard()">Copy Code</button>
  </div>
  ```

- [ ] **2.1.5** Badge cache strategy
  - CloudFront CDN před Lambda (pro snížení cost)
  - Cache key: domainHash
  - TTL: 1 hodina (balance freshness vs cost)

- [ ] **2.1.6** Badge click tracking (optional)
  - Redirect through tracking URL
  - Log impressions do DynamoDB
  - Analytics: kolik lidí klikne na badge

- [ ] **2.1.7** Landing page pro badge
  - `/badge-info` page
  - Vysvětlení jak badge funguje
  - CTA: "Get Your Badge" → Start scan

**Test:**
- Scan domain
- Generate badge URL
- Embed na test stránku
- Verify: Badge se zobrazí
- Verify: Score je aktuální
- Verify: Click vede na report

---

## 📋 Fáze 3: "Painkiller" Funkce (EU Legislativa 2025)

### ⚖️ 3.1 Auto-Generated Accessibility Statement
**Priorita:** 🟡 MEDIUM  
**Business Value:** EU EAA compliance, unique selling point  
**Effort:** ~4-6 hodin

#### Implementační kroky:

- [ ] **3.1.1** Vytvořit `AccessibilityStatementGenerator.ts`
  ```typescript
  class AccessibilityStatementGenerator {
    generate(report: AuditReport, domain: string): string {
      const date = new Date().toLocaleDateString('cs-CZ');
      const score = report.score;
      const critical = report.violations.critical;
      
      if (score === 100) {
        return this.generateCompliantStatement(domain, date);
      } else {
        return this.generatePartialStatement(domain, date, critical);
      }
    }
    
    private generateCompliantStatement(domain: string, date: string): string {
      return `
        # Prohlášení o přístupnosti
        
        ${domain} se zavazuje k dodržování Směrnice EU 2019/882 
        o požadavcích na přístupnost pro produkty a služby.
        
        ## Stav souladu
        
        Tento web je **plně v souladu** s evropskou normou EN 301 549 
        a pokyny WCAG 2.1 úrovně AA.
        
        Datum posledního testování: ${date}
        Metoda: Automatizované testování pomocí A11y-Flow
        
        ## Kontakt
        
        V případě zjištění problému s přístupností nás prosím kontaktujte.
      `;
    }
    
    private generatePartialStatement(
      domain: string, 
      date: string, 
      critical: AccessibilityViolation[]
    ): string {
      const issues = critical.map(v => `- ${v.title}`).join('\n');
      
      return `
        # Prohlášení o přístupnosti
        
        ${domain} se zavazuje k dodržování Směrnice EU 2019/882.
        
        ## Stav souladu
        
        Tento web je **částečně v souladu** s požadavky EN 301 549.
        
        ### Identifikované nedostatky
        
        ${issues}
        
        Tyto nedostatky aktivně řešíme a plánujeme odstranit do [datum].
        
        Datum testování: ${date}
        
        ## Kontakt
        
        Pro nahlášení problému: accessibility@${domain}
      `;
    }
  }
  ```

- [ ] **3.1.2** Přidat do AuditReport
  ```typescript
  interface AuditReport {
    // ... existing
    accessibilityStatement?: string; // Markdown format
    accessibilityStatementHtml?: string; // HTML format
  }
  ```

- [ ] **3.1.3** Integrace do WebScanner
  - Po dokončení scanu
  - Generate statement
  - Add do reportu

- [ ] **3.1.4** Export možnosti
  - Download jako `.md` file
  - Download jako `.html` snippet
  - Copy to clipboard button

- [ ] **3.1.5** Customization options (Pro Plan)
  - Umožnit custom kontaktní údaje
  - Umožnit custom timelines ("odstranit do 30 dní")
  - Umožnit logo firmy

- [ ] **3.1.6** Legal disclaimer
  - "Toto je generované prohlášení. Doporučujeme konzultaci s právníkem."
  - Link na EU direktivy

- [ ] **3.1.7** Lokalizace
  - CS, EN, DE (němčina důležitá pro EU trh)
  - Auto-detect z domain TLD

**Test:**
- Scan s perfektním skóre → verify compliant statement
- Scan s violations → verify partial statement
- Verify: Issues jsou správně vypsané
- Verify: Legal references jsou správné

---

## 🛠️ Fáze 4: "Fix-it Snippets" (Smart Remediation)

### 💡 4.1 Code Snippets pro Opravu
**Priorita:** 🟢 HIGH  
**Business Value:** Praktická hodnota, zkracuje "time to fix"  
**Effort:** ~6-8 hodin

#### Implementační kroky:

- [ ] **4.1.1** Rozšířit `RemediationService.ts`
  - Přidat metodu `getCodeSnippet(violationId: string, context?: any): CodeSnippet`
  ```typescript
  interface CodeSnippet {
    before: string;  // Wrong code
    after: string;   // Fixed code
    language: string; // 'html', 'css', 'javascript'
    explanation: string;
  }
  ```

- [ ] **4.1.2** Implementovat snippets pro top 10 issues
  
  **Image Alt Text (`image-alt`):**
  ```typescript
  before: '<img src="logo.png">',
  after: '<img src="logo.png" alt="Název vaší firmy">',
  explanation: 'Každý <img> musí mít popisný alt atribut...'
  ```
  
  **Missing Form Label (`label`):**
  ```typescript
  before: '<input type="text" name="email">',
  after: '<label for="email">E-mail:</label>\n<input type="text" id="email" name="email">',
  ```
  
  **Color Contrast (`color-contrast`):**
  ```typescript
  before: 'color: #999; background: #fff;',
  after: 'color: #666; background: #fff; /* Contrast 4.5:1 */',
  ```
  
  **Missing Lang (`html-has-lang`):**
  ```typescript
  before: '<html>',
  after: '<html lang="cs">',
  ```
  
  **Heading Order (`heading-order`):**
  ```typescript
  before: '<h1>Title</h1>\n<h3>Subtitle</h3>',
  after: '<h1>Title</h1>\n<h2>Subtitle</h2>',
  ```

- [ ] **4.1.3** Context-aware snippets
  - Pokud máme `violation.nodes[0].html`, použít pro before
  - Extract element tag, attributes
  - Generate realistic after code

- [ ] **4.1.4** Snippet templates
  - `/src/core/remediation-snippets.json`
  ```json
  {
    "image-alt": {
      "template": "<img src=\"{src}\" alt=\"{alt}\">",
      "variables": {
        "src": "actual_src_from_violation",
        "alt": "Descriptive text here"
      }
    }
  }
  ```

- [ ] **4.1.5** Přidat do HumanReadableActionItem
  ```typescript
  interface HumanReadableActionItem {
    // ... existing
    codeSnippet?: CodeSnippet;
  }
  ```

- [ ] **4.1.6** UI v HTML reportu
  - Accordion pro každý action item
  - "Show Fix" button
  - Syntax highlighting (použít `highlight.js`)
  - Copy button pro snippet

- [ ] **4.1.7** Bulk download
  - "Download All Fixes" button
  - ZIP file s všemi snippets
  - Grouped by file/component

**Test:**
- Scan stránku s image-alt violations
- Verify: Code snippet je shown
- Verify: Before/After je správný
- Verify: Copy funguje

---

## 🎨 Fáze 5: Headless MVP 2.0 (Low Energy Path)

### 📧 5.1 Email-Based Workflow
**Priorita:** 🟢 HIGH  
**Business Value:** No frontend needed, minimal maintenance  
**Effort:** ~8-12 hodin

#### Implementační kroky:

- [ ] **5.1.1** Simple Landing Page
  - Single HTML file (host na S3)
  - Form: URL + Email
  - Submit → API Gateway → Lambda
  - No login, no dashboard

- [ ] **5.1.2** Lambda handler `submitScanRequest.ts`
  ```typescript
  interface ScanRequest {
    url: string;
    email: string;
    plan?: 'free' | 'one-time' | 'subscription';
  }
  
  async function handleScanRequest(request: ScanRequest) {
    // 1. Validate URL
    // 2. If paid plan → verify payment via Stripe
    // 3. Queue scan (SQS or immediate)
    // 4. Send confirmation email
    // 5. Return: { requestId, estimatedTime: '2-3 minutes' }
  }
  ```

- [ ] **5.1.3** Scan completion notification
  - Po dokončení scanu
  - Upload report na S3 s public URL (s expirací 30 dní)
  - Send email přes AWS SES
  ```
  Subject: Your Accessibility Report is Ready!
  
  Hi there,
  
  Your accessibility scan for {url} is complete!
  
  Score: {score}/100
  Critical Issues: {criticalCount}
  
  View Full Report: {s3Url}
  
  [If Pro Plan] Download PDF: {pdfUrl}
  
  Want automatic monthly scans? Upgrade to Pro for $19/month.
  ```

- [ ] **5.1.4** Email templates
  - `/src/templates/email-scan-complete.html`
  - Professional design (použít MJML framework)
  - Responsive
  - CTA buttons: View Report, Upgrade

- [ ] **5.1.5** AWS SES setup
  ```bash
  npm run setup-ses
  ```
  - Verify sender email
  - Request production access (sandbox → production)
  - Setup bounce/complaint handling

- [ ] **5.1.6** Rate limiting
  - Free tier: 1 scan per email per day
  - Store in DynamoDB: `email-{hash}` → lastScanTime
  - Return 429 if exceeded

- [ ] **5.1.7** S3 report hosting
  - Bucket: `a11yflow-reports`
  - Public read, but obfuscated URLs
  - Generate: `https://reports.a11yflow.com/{uuid}.html`
  - Lifecycle policy: delete after 30 days (Free), keep forever (Paid)

- [ ] **5.1.8** Landing page deploy
  - Create S3 bucket: `a11yflow-landing`
  - Enable static website hosting
  - CloudFront distribution
  - Custom domain: `www.a11yflow.com`

**Test:**
- Submit form na landing page
- Verify: Confirmation email přijde
- Wait for scan
- Verify: Report email přijde s working links
- Verify: Rate limit funguje

---

### 💳 5.2 Payment Integration (Stripe)
**Priorita:** 🟡 MEDIUM  
**Business Value:** Monetizace  
**Effort:** ~4-6 hodin (už máte základy)

#### Implementační kroky:

- [ ] **5.2.1** Stripe Products setup
  ```typescript
  // One-time Audit: $29
  {
    name: 'One-Time Accessibility Audit',
    price: 2900, // cents
    features: [
      'Full accessibility report',
      'PDF export',
      'Annotated screenshots',
      'Fix-it code snippets',
      'Accessibility statement',
      'Report valid for 30 days'
    ]
  }
  
  // Subscription: $19/month
  {
    name: 'Pro Subscription',
    price: 1900,
    interval: 'month',
    features: [
      'Monthly automatic scans',
      'Unlimited PDF exports',
      'Scan history',
      'Dynamic badge',
      'Priority support',
      'White-label reports'
    ]
  }
  ```

- [ ] **5.2.2** Stripe Checkout integration
  - Landing page: "Get Audit" button
  - Redirect to Stripe Checkout
  - Success URL: `?session_id={CHECKOUT_SESSION_ID}`
  - Cancel URL: back to landing

- [ ] **5.2.3** Webhook handler enhancement
  - Už máte `StripeWebhookHandler.ts`
  - Add handling for:
    - `checkout.session.completed` → trigger scan
    - `customer.subscription.created` → setup recurring scans
    - `customer.subscription.deleted` → cancel recurring

- [ ] **5.2.4** DynamoDB schema pro customers
  ```typescript
  interface Customer {
    customerId: string; // Stripe customer ID
    email: string;
    plan: 'free' | 'one-time' | 'subscription';
    subscriptionId?: string;
    subscriptionStatus?: 'active' | 'canceled' | 'past_due';
    scanCredits: number; // For one-time audits
    lastScanDate?: string;
    nextScanDate?: string; // For subscriptions
  }
  ```

- [ ] **5.2.5** EventBridge schedule pro subscription scans
  - Už máte `ScanScheduler.ts`
  - Enhance: Query DynamoDB for customers with `nextScanDate <= today`
  - Trigger scan
  - Send report email
  - Update `lastScanDate`, `nextScanDate`

- [ ] **5.2.6** Customer portal link v emailu
  - Stripe Customer Portal
  - Allow: Cancel subscription, update payment method
  - Link v footer emailu: "Manage Subscription"

- [ ] **5.2.7** Free tier badge
  - Badge endpoint check if domain has active subscription
  - If yes: Real-time updated badge
  - If no: Static "Get Scanned" badge

**Test:**
- Buy one-time audit
- Verify: Scan triggers
- Verify: PDF is generated
- Subscribe to Pro
- Verify: Monthly scan triggers
- Cancel subscription
- Verify: Scans stop

---

## 📊 Fáze 6: Analytics & Monitoring

### 📈 6.1 Basic Analytics
**Priorita:** 🔵 LOW  
**Effort:** ~2-3 hodiny

- [ ] **6.1.1** CloudWatch Dashboard
  - Lambda invocations
  - Error rate
  - Duration (scan time)
  - Memory usage

- [ ] **6.1.2** Business metrics v DynamoDB
  ```typescript
  interface Metrics {
    date: string; // YYYY-MM-DD
    totalScans: number;
    freeScans: number;
    paidScans: number;
    totalRevenue: number;
    newCustomers: number;
    churnedCustomers: number;
  }
  ```

- [ ] **6.1.3** Simple dashboard page
  - Read-only view of metrics
  - No complex charts, just numbers
  - Update via EventBridge daily

---

## 🚀 Priority Matrix

| Feature | Priority | Effort | Value | Status |
|---------|----------|--------|-------|--------|
| Screenshot Annotator | 🔴 HIGH | 6h | HIGH | ⬜ TODO |
| Fix-it Code Snippets | 🟢 HIGH | 8h | HIGH | ⬜ TODO |
| Email Workflow | 🟢 HIGH | 10h | HIGH | ⬜ TODO |
| Dynamic Badges | 🟢 HIGH | 4h | MEDIUM | ⬜ TODO |
| PDF Export | 🟡 MEDIUM | 4h | MEDIUM | ⬜ TODO |
| Accessibility Statement | 🟡 MEDIUM | 5h | MEDIUM | ⬜ TODO |
| Payment Integration | 🟡 MEDIUM | 5h | HIGH | ⬜ TODO |
| Analytics | 🔵 LOW | 3h | LOW | ⬜ TODO |

**Total Estimated Effort:** ~45-50 hodin  
**MVP 2.0 (Minimum):** Screenshot Annotator + Email Workflow + Payment = ~20 hodin

---

## 📅 Doporučený Timeline (Low Energy Approach)

### Týden 1-2: Visual Wow Factor
- ✅ Screenshot Annotator
- ✅ Fix-it Code Snippets
- ✅ Test na reálných stránkách

### Týden 3-4: Email Workflow
- ✅ Landing page
- ✅ SES integration
- ✅ S3 report hosting
- ✅ Test end-to-end

### Týden 5: Monetizace
- ✅ Stripe products setup
- ✅ Payment flow
- ✅ Subscription handling

### Týden 6: Polish & Launch
- ✅ Dynamic badges
- ✅ PDF export
- ✅ Accessibility statement
- ✅ Soft launch

---

## 💡 Business Model Recap

### Free Tier
- ✅ 1 scan per email per day
- ✅ Basic score & summary
- ✅ Static badge
- ❌ No PDF
- ❌ No annotated screenshots
- ❌ No code snippets

### One-Time Audit ($29)
- ✅ Full scan
- ✅ PDF report
- ✅ Annotated screenshots
- ✅ Fix-it code snippets
- ✅ Accessibility statement
- ✅ Valid 30 days

### Pro Subscription ($19/month)
- ✅ Monthly automatic scans
- ✅ All One-Time features
- ✅ Unlimited PDF exports
- ✅ Scan history
- ✅ Dynamic real-time badge
- ✅ White-label option
- ✅ Priority support

---

## 🎯 Success Metrics (Post-Launch)

- **Week 1:** 50 free scans
- **Month 1:** 10 paid audits
- **Month 3:** 5 Pro subscriptions
- **Month 6:** 20 Pro subscriptions = $380 MRR

**Break-even:** ~15 Pro subscribers (covers AWS costs ~$100-150/month)

---

## 📝 Notes & Considerations

### Health-Conscious Development
- **Max 2-3 hodin coding per day**
- **Prioritize High Value / Low Effort features first**
- **Outsource UI/design if possible** (Fiverr, Upwork)
- **Use templates** (email: MJML, landing page: Tailwind templates)

### Technical Debt to Avoid
- ❌ Don't build custom authentication system
- ❌ Don't build complex admin dashboard
- ❌ Don't optimize prematurely
- ✅ Keep it simple, iterate based on customer feedback

### Future Ideas (Post-MVP)
- Historical comparison (diff between scans)
- Slack/Discord notifications
- API for developers
- Zapier/Make.com integration
- Multi-language support
- Accessibility Score API widget

---

**Last Updated:** 3. ledna 2026  
**Document Owner:** A11y-Flow Product Team  
**Next Review:** Po dokončení MVP 2.0
