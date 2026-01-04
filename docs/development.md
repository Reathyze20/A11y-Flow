# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: Node.js 20)
- npm or yarn package manager
- Git
- Text editor or IDE (VS Code recommended)

### Initial Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd a11y-flow
```

2. Install dependencies:
```bash
npm install
```

3. Verify installation:
```bash
npm test
```

## Project Structure

```
a11y-flow/
├── src/                          # Source code
│   ├── core/                     # Core scanning functionality
│   │   ├── acts/                 # Custom ACT-like test suites
│   │   │   ├── ActRuleRegistry.ts
│   │   │   ├── FocusOrder.ts
│   │   │   ├── SkipLink.ts
│   │   │   ├── ModalFocus.ts
│   │   │   ├── Landmarks.ts
│   │   │   ├── CarouselAutoplay.ts
│   │   │   └── FormErrors.ts
│   │   ├── WebScanner.ts        # Main scanner orchestrator
│   │   ├── Crawler.ts           # Multi-page crawling
│   │   ├── ActMapper.ts         # Maps violations to ACT rules
│   │   ├── ViolationMapper.ts   # WCAG mapping
│   │   └── types.ts             # TypeScript types
│   ├── handlers/                # AWS Lambda handlers
│   └── scripts/                 # Build and deployment scripts
├── report-modules/              # HTML report generator modules
├── tests/                       # Test files and scripts
├── test-pages/                  # Local test HTML pages
├── docs/                        # Documentation
└── dist/                        # Build output

```

## Development Workflow

### Running Local Tests

The project includes several test scripts in the `tests/` folder:

**Test single page locally:**
```bash
npm run test:local
```

This runs `tests/test-local.ts` which scans a single page and generates JSON/HTML reports.

**Test heading structure:**
```bash
npm run test:headings
```

Runs `tests/test-heading-structure.ts` for testing H1-H6 hierarchy detection.

**Run all test scenarios:**
```bash
npx ts-node tests/run-test-suite.ts
```

Executes all ACT-like tests against local test pages in `test-pages/`.

**Advanced local scanning:**
```bash
npx ts-node tests/run-local-scan-v2.ts
```

Enhanced scanner with additional features.

### Test Pages

The `test-pages/` directory contains HTML files for testing specific accessibility rules:

- `test-pages/rules/alt-text.html` - Image alternative text
- `test-pages/rules/focus-order.html` - Keyboard navigation
- `test-pages/rules/modal.html` - Modal dialog focus management
- `test-pages/rules/forms.html` - Form error handling
- `test-pages/rules/carousel.html` - Auto-playing carousels
- `test-pages/rules/landmarks.html` - ARIA landmarks
- `test-pages/rules/skip-link.html` - Skip navigation links

**Serve test pages locally:**
```bash
npx http-server test-pages -p 8080
```

Then run tests against `http://localhost:8080/rules/`

### Generating Reports

**From JSON to HTML:**
```bash
node generate-html-report-v2.js tests/test-crawl-real.json
```

This generates an HTML report in the same directory.

**For single-page scans:**
```bash
node generate-html-report-v2.js tests/test-single-page.json
```

**For multi-page crawls:**
```bash
node generate-html-report-v2.js tests/test-crawl-results.json
```

The report automatically detects whether it's a single-page or crawl format.

## Adding New Features

### Adding a New ACT Rule

1. Create a new file in `src/core/acts/`:

```typescript
// src/core/acts/MyNewRule.ts
import { Page } from 'puppeteer';
import { CustomActResult } from '../types';

export async function checkMyNewRule(page: Page): Promise<CustomActResult> {
  try {
    // Your test logic here
    const result = await page.evaluate(() => {
      // Client-side detection
      return {
        passed: true,
        elements: []
      };
    });

    return {
      id: 'my-new-rule',
      title: 'My New Accessibility Rule',
      description: 'Description of what this rule checks',
      wcagCriteria: ['2.4.1', '2.4.4'],
      actRuleId: 'official-act-id', // if available
      passed: result.passed,
      impact: 'serious',
      nodes: result.elements
    };
  } catch (error) {
    console.error('Error in MyNewRule:', error);
    return {
      id: 'my-new-rule',
      title: 'My New Accessibility Rule',
      passed: true,
      impact: 'serious',
      nodes: []
    };
  }
}
```

2. Register in `src/core/acts/CustomActSuite.ts`:

```typescript
import { checkMyNewRule } from './MyNewRule';

export async function runCustomActSuite(page: Page): Promise<CustomActResult[]> {
  return Promise.all([
    checkFocusOrder(page),
    checkSkipLink(page),
    checkMyNewRule(page), // Add here
    // ... other rules
  ]);
}
```

3. Add test page in `test-pages/rules/my-new-rule.html`

4. Update documentation in `docs/modules.md`

### Adding a New Report Module

1. Create module file in `report-modules/`:

```javascript
// report-modules/my-module.js

/**
 * My Module - Description
 */

const { escapeHtml } = require('./utils');

function generateMyModule(data) {
  return `
    <div class="my-module">
      <h2>My Section</h2>
      <p>${escapeHtml(data.someField)}</p>
    </div>
  `;
}

module.exports = generateMyModule;
```

2. Import in `generate-html-report-v2.js`:

```javascript
const generateMyModule = require('./report-modules/my-module');

// In HTML assembly:
const html = `
  ...
  ${generateMyModule(data)}
  ...
`;
```

3. Update `docs/modules.md` with module documentation

### Modifying Styles

All styles are in `report-modules/styles.js`:

```javascript
// Add new CSS variables
:root {
  --my-custom-color: #3b82f6;
}

// Add new component styles
.my-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
```

Styles support theming - add light mode overrides:

```css
[data-theme="light"] {
  --my-custom-color: #1d4ed8;
}
```

## Building and Deployment

### Local Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` folder.

### Clean Build

```bash
npm run clean
npm run build
```

### AWS Deployment

**Initialize AWS resources:**
```bash
npm run init-aws
npm run init-db
npm run init-api
```

**Deploy Lambda function:**
```bash
npm run deploy
```

**Set Stripe webhook secret:**
```bash
npm run set-stripe-secret
```

## Testing

### Unit Tests

```bash
npm test
```

Runs Jest test suite for core functionality.

### Manual Testing Checklist

Before committing changes:

1. Run local tests:
   - `npm run test:local`
   - `npm run test:headings`

2. Generate reports:
   - Single-page report
   - Multi-page crawl report

3. Verify report features:
   - Theme toggle works
   - All tabs display correctly
   - Page sorting works (crawl mode)
   - Modal opens with details (crawl mode)
   - Print styles work

4. Check browser compatibility:
   - Chrome/Edge
   - Firefox
   - Safari

5. Validate HTML:
   - No console errors
   - Proper accessibility (use screen reader)

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types
- Document public functions with JSDoc
- Use descriptive variable names

```typescript
/**
 * Scans a web page for accessibility violations
 * @param url - The URL to scan
 * @param options - Scanner configuration options
 * @returns Promise resolving to scan results
 */
export async function scanPage(
  url: string, 
  options: ScanOptions
): Promise<ScanResult> {
  // Implementation
}
```

### JavaScript (Report Modules)

- Use modern ES6+ features
- Keep functions pure when possible
- Use template literals for HTML
- Escape all user-generated content

```javascript
function generateComponent(data) {
  const { title, description } = data;
  return `
    <div class="component">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}
```

### CSS

- Use CSS variables for theming
- Follow BEM naming when appropriate
- Mobile-first responsive design
- Ensure WCAG AA contrast ratios

## Debugging

### Enable Verbose Logging

```typescript
// In test files
const scanner = new WebScanner({ verbose: true });
```

### Debug Puppeteer

```typescript
const browser = await puppeteer.launch({
  headless: false, // Show browser
  devtools: true,  // Open DevTools
  slowMo: 100      // Slow down by 100ms
});
```

### Debug Report Generation

```javascript
// In generate-html-report-v2.js
console.log('Data structure:', JSON.stringify(data, null, 2));
console.log('Calculated stats:', stats);
```

### Common Issues

**"Cannot find module" error:**
- Ensure you're in project root
- Run `npm install`
- Check file paths are correct

**Puppeteer launch errors:**
- Install Chrome/Chromium
- Check system dependencies
- Try: `npm install puppeteer --force`

**Report not displaying correctly:**
- Check browser console for errors
- Verify JSON structure
- Ensure all modules loaded

**Theme not persisting:**
- Check localStorage in browser
- Verify scripts.js loaded
- Clear browser cache

## Performance Optimization

### Scanner Performance

- Use `page.evaluate()` for DOM queries
- Batch operations when possible
- Close browser instances properly
- Limit concurrent crawl pages

### Report Generation

- Minimize string concatenations
- Cache computed values
- Lazy-load modal content
- Optimize large data sets

## Contributing Guidelines

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes with clear commits
4. Add/update tests
5. Update documentation
6. Run test suite: `npm test`
7. Generate sample reports to verify
8. Submit pull request

### Commit Messages

Follow conventional commits:

```
feat: Add new ACT rule for orientation lock
fix: Correct heading level detection
docs: Update development guide
refactor: Simplify violation mapping logic
test: Add tests for modal focus
style: Format code with prettier
```

## Troubleshooting

### Installation Issues

**Node version too old:**
```bash
nvm install 20
nvm use 20
npm install
```

**Puppeteer installation fails:**
```bash
npm install puppeteer --ignore-scripts
npx puppeteer browsers install chrome
```

### Development Issues

**TypeScript errors:**
```bash
npx tsc --noEmit
```

**Module resolution errors:**
- Check `tsconfig.json` paths
- Verify imports use correct extensions
- Clear `node_modules` and reinstall

**Test failures:**
- Check test-pages are served correctly
- Verify browser launched successfully
- Review error stack traces

## Resources

### Internal Documentation

- [Architecture Overview](architecture.md)
- [Module Reference](modules.md)
- [Usage Guide](usage.md)
- [Data Structures](data-structures.md)
- [Theming System](theming.md)

### External References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [ACT Rules](https://act-rules.github.io/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [Puppeteer Documentation](https://pptr.dev/)
- [EN 301 549 Standard](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/)

## Getting Help

- Check existing documentation
- Review test files for examples
- Search GitHub issues
- Ask in team chat/email

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Run local test
npm run test:local

# Generate HTML report
node generate-html-report-v2.js tests/test-results.json

# Build for production
npm run build

# Deploy to AWS
npm run deploy

# Run unit tests
npm test

# Verify ACT rules
npm run verify-rules
```

### File Locations

- Scanner core: `src/core/WebScanner.ts`
- ACT rules: `src/core/acts/`
- Report generator: `generate-html-report-v2.js`
- Report modules: `report-modules/`
- Test files: `tests/`
- Test pages: `test-pages/rules/`
- Documentation: `docs/`

### Key Concepts

- **WebScanner**: Main orchestrator for scanning pages
- **ACT Rules**: Custom accessibility tests beyond axe-core
- **Crawler**: Multi-page website scanning
- **ViolationMapper**: Maps findings to WCAG criteria
- **Report Modules**: Modular HTML generation
- **Theme System**: Light/dark mode support
