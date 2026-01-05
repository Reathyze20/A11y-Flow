# A11y-Flow - AI Project Overview

## Project Summary

A11y-Flow is an **open-source npm package** for automated WCAG 2.1/2.2 accessibility testing. The tool combines axe-core static analysis with custom ACT-like tests (behavioral scenarios) using Puppeteer to detect accessibility issues that traditional scanners miss.

**New Strategy:** Free open-source tool with cloud hosting option (Open Core model)  
**Target Users:** Web developers, UX/Product teams, digital agencies, compliance officers  
**Value Proposition:** Developer-first accessibility testing with beautiful reports, PR diff analysis, and zero-friction CI/CD integration  

**Killer Feature:** **Differential analysis in Pull Requests** - Only reports new issues and fixes, not overwhelming 500-error lists. Makes accessibility checks a helpful assistant, not a gatekeeper.

## Technical Architecture

### Stack

**Backend:**
- Runtime: Node.js 18+ with TypeScript
- Browser Automation: Puppeteer + Puppeteer-core
- Testing Engine: axe-core 4.8+ for static analysis
- Cloud: AWS Serverless (Lambda, DynamoDB, S3, API Gateway)
- Payments: Stripe subscriptions and webhooks

**Frontend (Reports):**
- Modular HTML/CSS/JavaScript (no framework dependencies)
- Self-contained reports (all assets inline)
- Theme system: CSS variables with localStorage persistence
- Responsive design with Tailwind utility classes

**Infrastructure:**
- Deployment: AWS Lambda with @sparticuz/chromium
- Storage: DynamoDB for scan history, user data, subscriptions
- File Storage: S3 for report artifacts and badges
- API: REST via API Gateway with API key authentication

### Project Structure

```
a11y-flow/
├── src/
│   ├── core/                        # Core scanning engine
│   │   ├── WebScanner.ts           # Main orchestrator
│   │   ├── Crawler.ts              # Multi-page crawling
│   │   ├── acts/                   # Custom ACT-like tests
│   │   │   ├── FocusOrder.ts       # Keyboard navigation
│   │   │   ├── SkipLink.ts         # Skip navigation
│   │   │   ├── ModalFocus.ts       # Modal focus management
│   │   │   ├── Landmarks.ts        # ARIA landmarks
│   │   │   ├── CarouselAutoplay.ts # Auto-playing content
│   │   │   ├── FormErrors.ts       # Form error handling
│   │   │   └── [9 detection types]
│   │   ├── ActMapper.ts            # Maps violations to official ACT rules
│   │   ├── ViolationMapper.ts      # WCAG 2.1/2.2 criterion mapping
│   │   └── types.ts                # TypeScript interfaces
│   ├── handlers/                    # AWS Lambda handlers
│   │   ├── StripeWebhookHandler.ts # Payment processing
│   │   ├── ScanScheduler.ts        # Scheduled scans
│   │   ├── HistoryHandler.ts       # Scan history API
│   │   ├── generatePDFHandler.ts   # PDF export (Pro tier)
│   │   └── badgeHandler.ts         # Embeddable badges
│   └── scripts/                     # DevOps scripts
├── report-modules/                  # Modular report generator
│   ├── utils.js                    # Shared helpers
│   ├── styles.js                   # CSS + theme system
│   ├── scripts.js                  # Interactive JavaScript
│   ├── header.js                   # Header with theme toggle
│   ├── sidebar.js                  # Navigation menu
│   ├── summary-single.js           # Single-page overview
│   ├── summary-crawl.js            # Multi-page overview
│   ├── performance.js              # Core Web Vitals
│   ├── heading-structure.js        # H1-H6 analysis
│   └── page-modal.js               # Page detail modal
├── tests/                           # Test files and scripts
├── test-pages/rules/                # HTML test pages
├── docs/                            # Complete documentation
└── generate-html-report-v2.js       # Report orchestrator
```

## Current Features

### Scanning Capabilities

**Static Analysis (axe-core):**
- Alternative text for images (WCAG 1.1.1)
- Color contrast ratios (WCAG 1.4.3, 1.4.6)
- Form labels and descriptions (WCAG 1.3.1, 3.3.2)
- Heading structure (WCAG 1.3.1)
- ID uniqueness (WCAG 4.1.1)
- Language attributes (WCAG 3.1.1, 3.1.2)
- 50+ additional axe rules mapped to ACT Rules

**Behavioral Tests (Custom ACT Suite):**
1. **focus-order** - Keyboard navigation and focus traps (WCAG 2.1.2, 2.4.3)
2. **skip-link** - Skip navigation functionality (WCAG 2.4.1)
3. **modal-focus** - Modal dialog focus management (WCAG 2.1.2, 2.4.3)
4. **landmarks** - ARIA landmark structure (WCAG 1.3.1)
5. **carousel-autoplay** - Auto-playing content controls (WCAG 2.2.2)
6. **form-errors** - Error identification and description (WCAG 3.3.1, 3.3.3)

**Advanced Features:**
- Multi-page crawling with sitemap support
- Performance metrics (Core Web Vitals: LCP, CLS, TBT, FCP, TTFB)
- Heading hierarchy analysis (9 detection types)
- Device profiles (desktop, mobile, tablet, low-vision, reduced-motion)

### Report Generation

**Two Modes:**
1. **Single-page scan** - Detailed analysis of one URL
2. **Multi-page crawl** - Aggregate analysis across entire website

**Report Features:**
- Interactive HTML with no external dependencies
- Light/Dark theme toggle with localStorage
- Sortable page list (6 sort options in crawl mode)
- Full-screen modal for individual page details
- Core Web Vitals with color-coded ratings
- Heading structure visualization
- Educational content explaining metrics
- Print-optimized styles

**Modular Architecture:**
- 10 independent components
- Easy to extend with new sections
- Theme system with CSS variables
- Backward compatible with legacy data formats

### SaaS Features

**Pricing Tiers:**
1. **Free** - Limited scans, basic reports, no PDF export
2. **Pro** - Unlimited scans, PDF export, scheduled scanning, priority support
3. **One-Time Audit** - Single comprehensive audit for agencies/enterprises

**Platform Features:**
- API Gateway with API key authentication
- Stripe subscription management
- Webhook handlers for payment events
- Scheduled scanning (cron-like for Pro users)
- Scan history tracking (DynamoDB)
- Embeddable accessibility badges
- PDF report export (Pro tier only)

**Security:**
- API key authentication (X-Api-Key header)
- Environment variable configuration
- CORS headers for cross-origin requests
- Input validation and sanitization

## Data Structures

### JSON Report Format

**Single-Page:**
```json
{
  "url": "https://example.com",
  "score": 85,
  "violations": [...],
  "performance": {
    "coreWebVitals": { "lcp": 1800, "cls": 0.05, "tbt": 150 },
    "navigation": { "firstContentfulPaint": 1200, "timeToFirstByte": 300 }
  },
  "headingStructure": {
    "headings": [{ "level": 1, "text": "Title", "selector": "h1" }],
    "detections": [{ "type": "missing-h1", "message": "..." }]
  },
  "timestamp": "2026-01-04T10:30:00.000Z"
}
```

**Multi-Page Crawl:**
```json
{
  "rootUrl": "https://example.com",
  "averageScore": 82,
  "totalPagesScanned": 10,
  "totalViolations": 45,
  "totalCriticalViolations": 5,
  "pages": [
    { "url": "...", "score": 90, "violations": [...] },
    { "url": "...", "score": 75, "violations": [...] }
  ]
}
```

**Violation Structure:**
```json
{
  "id": "image-alt",
  "impact": "critical",
  "title": "Images must have alternate text",
  "description": "Ensures <img> elements have alt text",
  "help": "Images must have alternate text",
  "helpUrl": "https://dequeuniversity.com/rules/axe/4.0/image-alt",
  "tags": ["wcag2a", "wcag111", "cat.text-alternatives"],
  "wcagCriteria": ["1.1.1"],
  "actRuleId": "23a2a8",
  "nodes": [
    {
      "html": "<img src=\"logo.png\">",
      "target": ["#header img"],
      "failureSummary": "Fix: Add alt attribute",
      "impact": "critical"
    }
  ]
}
```

## Standards Compliance

**WCAG 2.1 & 2.2 Coverage:**
- Target Level: A and AA (EU legislation requirement)
- Mapped criteria: 1.1.1, 1.3.1, 1.4.3, 2.1.2, 2.4.1, 2.4.3, 3.3.1, 3.3.3, 4.1.1, and 40+ more
- ACT Rules mapping where available (official W3C test rules)

**EN 301 549:**
- European standard for ICT accessibility
- Covered indirectly through WCAG criteria

**Limitations:**
- Automated testing captures ~30-50% of real accessibility issues
- Requires manual expert audit and user testing for complete compliance
- Semantic/contextual issues (alt text quality, error message clarity) need human review

## Expansion Opportunities

### Feature Ideas

**Enhanced Testing:**
- [ ] Contrast analyzer for non-text elements (charts, icons, UI components)
- [ ] Video/audio content accessibility (captions, transcripts, audio descriptions)
- [ ] Touch target size analysis (WCAG 2.5.5, 2.5.8)
- [ ] Motion/animation detection (WCAG 2.3.1, 2.3.2)
- [ ] Session timeout warnings (WCAG 2.2.1)
- [ ] Multi-language support detection
- [ ] Cognitive accessibility checks (reading level, plain language)
- [ ] Screen reader simulation/recording

**AI Integration:**
- [ ] GPT-powered alt text quality assessment
- [ ] Automated remediation code generation
- [ ] Natural language query for accessibility issues
- [ ] Intelligent false positive filtering
- [ ] Contextual explanation of violations

**Reporting Enhancements:**
- [ ] CSV export for violation data
- [ ] Trend analysis over time (historical comparisons)
- [ ] Team collaboration features (comments, assignments)
- [ ] Remediation progress tracking
- [ ] Custom branding for white-label reports
- [ ] Integration with project management tools (Jira, Linear)

**Platform Features:**
- [ ] Browser extension for on-demand scanning
- [ ] CI/CD integration (GitHub Actions, GitLab CI, CircleCI)
- [ ] Slack/Teams/Discord notifications
- [ ] Public accessibility status page
- [ ] Competitor comparison reports
- [ ] Accessibility score badges (embeddable SVG)

**Developer Tools:**
- [ ] VS Code extension for inline warnings
- [ ] Chrome DevTools extension
- [ ] Real-time scanning during development
- [ ] Hot reload integration
- [ ] Component library testing (Storybook integration)

**Enterprise Features:**
- [ ] Multi-tenant organization support
- [ ] Role-based access control (RBAC)
- [ ] SSO/SAML authentication
- [ ] Compliance certification reports
- [ ] SLA guarantees and uptime monitoring
- [ ] Dedicated support channels

**Business Model Extensions:**
- [ ] Reseller/agency program with white-label
- [ ] API-only tier for developers
- [ ] Consulting services marketplace
- [ ] Training/certification program
- [ ] Accessibility remediation service

### Technical Improvements

**Performance:**
- [ ] Parallel scanning for large crawls
- [ ] Intelligent page discovery (ML-based)
- [ ] Caching strategy for repeated scans
- [ ] Progressive report generation
- [ ] WebSocket streaming for real-time updates

**Reliability:**
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker pattern for external services
- [ ] Better error handling and recovery
- [ ] Health check endpoints
- [ ] Monitoring and alerting (CloudWatch, Datadog)

**Developer Experience:**
- [ ] SDK for Node.js, Python, Ruby
- [ ] GraphQL API option
- [ ] Webhook system for scan completion
- [ ] OpenAPI/Swagger documentation
- [ ] Postman collection

## Competition Analysis

**Direct Competitors:**
- **axe DevTools** - Browser extension, paid Pro version
- **WAVE** - Free browser extension, limited features
- **Siteimprove** - Enterprise solution, expensive
- **Lighthouse** - Free but limited to single pages, no crawling
- **Pa11y / Pa11y CI** - Open source but binary pass/fail, overwhelming output

**Killer Differentiators:**

1. **Diff Analysis in PRs** 🎯
   - Shows only NEW issues (regressions) vs. production baseline
   - Reports FIXED issues to motivate developers
   - Prevents "500 errors = ignored" problem
   - GitHub Actions integration out of the box
   - Smart fingerprinting of violations by element + rule

2. **Developer Experience**
   - npm package - install with `npm install -g a11y-flow`
   - CLI int 🚀 **NPM Package Launch**
- [x] Diff analysis implementation (AccessibilityDiffer class)
- [x] CLI interface with scan/crawl/diff/report commands
- [x] GitHub Actions workflow templates
- [ ] Publish to npm registry
- [ ] Documentation and examples
- [ ] GitHub README with badges
- [ ] Video demo and tutorial
3. **Beyond Static Analysis**
   - Custom ACT-like behavioral tests (focus, modals, forms)
   - Multi-page crawling with intelligent navigation
   - Performance metrics (Core Web Vitals)
   - Heading hierarchy analysis

4. **Modern Workflow Integration**
   - GitHub Actions templates ready to use
   - GitLab CI / CircleCI examples
   - PR comments with diff summaries
   - Artifact uploads for full reports
   - Vercel/Netlify deployment checks

## Development Roadmap Ideas

**Q1 2026:**
- [ ] Browser extension (Chrome, Firefox, Edge)
- [ ] CI/CD integrations (GitHub Actions, GitLab)
- [ ] Trend  🌟 **Growth & Community**
- [ ] Community adoption push (Dev.to, Reddit, HN)
- [ ] GitHub Sponsors setup
- [ ] VS Code extension for inline warnings
- [ ] Browser extension (Chrome, Firefox)
- [ ] Trend analysis / historical comparisons
- [ ] Badge  💼 **Cloud Platform Launch**
- [ ] Managed hosting option (open-core monetization)
- [ ] Scheduled scanning service
- [ ] Team collaboration features
- [ ] Historical trending and analytics
- [ ] AI-powered remediation suggestions (GPT-4)
- [ ] Slack/Teams/Discord notifications
**Q3 2026:**
- [ ] Screen reader simulation
- [ ] Touch  🏢 **Enterprise & Scale**
- [ ] Enterprise self-hosted version (with support contracts)
- [ ] SSO/SAML authentication
- [ ] White-label reports for agencies
- [ ] Reseller/partner program
- [ ] Video/audio accessibility testing
- [ ] Screen reader simulation
- [ ] Enterprise features (SSO, RBAC)
- [ ] Reseller program launch
- [ ] Mobile app for viewing reports
- [ ] Compliance certification templates

## Technical Debt & Improvements

**Code Quality:**
- [ ] Increase test coverage (currently limited Jest tests)
- [ ] Add E2E tests for report generation
- [ ] Improve TypeScript strict mode compliance
- [ ] Better error messages and logging
- [ ] Refactor large handlers into smaller functions

**Infrastructure:**
- [ ] Implement CI/CD pipeline
- [ ] Add staging environment
- [ ] Database migration system
- [ ] Infrastructure as Code (Terraform/CDK)
- [ ] Cost optimization analysis

**Documentation:**
- [ ] API reference documentation
- [ ] Video tutorials
- [ ] Interactive examples
- [ ] Migration guides for major versions
- [ ] Architecture decision records (ADRs)

## Key Metrics to Track

**Product Metrics:**
- Monthly active users (MAU)
- Scans per user per month
- Average pages scanned per crawl
- Report generation time
- API response times
- Free to Pro conversion rate

**Business Metrics:**
- MRR (Monthly Recurring Revenue)
- Churn rate
- Customer acquisition cost (CAC)
- Lifetime value (LTV)
- Trial to paid conversion
- Upgrade rate (Free → Pro)

**Technical Metrics:**
- Lambda execution duration
- DynamoDB read/write capacity
- S3 storage costs
- Error rates by handler
- API Gateway throttles
- Stripe webhook success rate

## Integration Opportunities

**Developer Tools:**
- GitHub/GitLab CI integration
- VS Code extension marketplace
- Chrome Web Store extension
- npm package for programmatic use

**Communication:**
- Slack app for notifications
- Microsoft Teams integration
- Discord webhooks
- Email reporting (SendGrid, Mailgun)

**Project Management:**
- Jira issue creation
- Linear integration
- Asana tasks
- Trello cards

**Analytics:**
- Google Analytics tracking
- Mixpanel events
- Segment integration
- AmpGo-to-Market Strategy:** Best channels for npm package adoption? Dev.to tutorials, conference talks, GitHub stars, Reddit /r/webdev?

2. **Diff Algorithm Refinement:** How to handle element selector changes (e.g., refactored HTML but same violation)? Content-based fingerprinting?

3. **CLI UX Polish:** What other commands would developers expect? `a11y-flow init` for config? `a11y-flow watch` for dev mode?

4. **GitHub Actions Marketplace:** Should we publish as official Action? What features would maximize adoption?

5. **Cloud Platform Features:** What would justify $10-50/month for hosted version vs. free self-hosted? Historical trends? Team dashboards? Slack integration?

6. **AI-Powered Fixes:** GPT-4 for generating remediation code - feasible? Prompts: "Fix this alt text violation: [context]" → Pull request with fix?

7. **Community Building:** How to grow GitHub stars fast? Product Hunt launch? Hackernews Show HN? Developer influencer partnerships?

8. **Baseline Management:** How to auto-update baseline after PR merge? GitHub Action to commit new baseline.json?

9. **Smart Grouping:** How to group similar violations? "10x missing alt text" → one line with "Show all 10"?

10. **Suppression Rules:** Format for `.a11yignore`? Rule ID + selector? Time-based suppressions ("ignore for 30 days")?

11. **Monetization Mix:** GitHub Sponsors vs. Cloud Platform vs. Enterprise Support - what ratio to target?

12. **Competition Response:** If Pa11y adds diff feature, what's our next moat? AI-powered fixes? Better UX? Perform

9. **Open Source Strategy:** Should we opivoting to open-source npm package  
**Current Version:** 2.0.0 (modular report generator + diff analysis)  
**Team Size:** Solo developer (community contributors welcome)  
**Tech Debt:** Low to moderate  
**Documentation:** Comprehensive (6 docs files + README + examples)

**Recent Changes:**
- ✅ Implemented `AccessibilityDiffer` class for PR diff analysis
- ✅ Created CLI interface (`bin/cli.js`) with scan/crawl/diff/report commands
- ✅ GitHub Actions workflow template (`.github/workflows/a11y-check.yml`)
- ✅ Examples directory with usage patterns
- ✅ Updated package.json for npm publishing

**Next Steps:**
1. Test CLI commands locally
2. Publish to npm registry (`npm publish`)
3. Create demo video
4. Write launch blog post
5. Submit to Product Hunt / Hacker News

**Business Model:** Open Core
- **Free:** npm package, self-hosted, full features
- **Cloud ($19-49/mo):** Managed hosting, scheduled scans, team features, historical trends
- **Enterprise:** Self-hosted + support contracts + white-label

**Project Status:** Active development, production-ready micro SaaS  
**Current Version:** 2.0 (modular report generator completed)  
**Team Size:** Solo developer (can be scaled)  
**Tech Debt:** Low to moderate  
**Documentation:** Comprehensive (5 docs files + README)

This document is intended for AI-assisted brainstorming and development planning. Update as the project evolves.
