# A11y-Flow Examples

This directory contains practical examples of using a11y-flow in various scenarios.

## CLI Usage

### Basic Scanning

```bash
# Scan a single page
a11y-flow scan https://example.com

# Scan with HTML output
a11y-flow scan https://example.com --format html --output report.html

# Fail if score is below threshold
a11y-flow scan https://example.com --threshold 85

# Fail if critical issues found
a11y-flow scan https://example.com --fail-on-critical
```

### Multi-Page Crawling

```bash
# Crawl entire website
a11y-flow crawl https://example.com --max-pages 50

# Generate both JSON and HTML
a11y-flow crawl https://example.com --format both --output crawl-report.json

# Limit crawl depth
a11y-flow crawl https://example.com --max-pages 20 --max-depth 2
```

### Diff Analysis (PR Checks)

```bash
# Compare two scans
a11y-flow diff baseline.json current.json

# Output markdown for PR comment
a11y-flow diff baseline.json current.json --format markdown --output diff.md

# Fail on any new issues
a11y-flow diff baseline.json current.json --max-new-issues 0 --exit-code

# Allow warnings, fail on critical only
a11y-flow diff baseline.json current.json --max-critical 0 --exit-code
```

## Programmatic API

### Basic Scanning

```javascript
const { scan, crawl } = require('a11y-flow');

// Scan single page
async function scanExample() {
  const result = await scan('https://example.com');
  
  console.log(`Score: ${result.score}`);
  console.log(`Violations: ${result.violations.length}`);
  
  // Filter critical issues
  const critical = result.violations.filter(v => v.impact === 'critical');
  console.log(`Critical issues: ${critical.length}`);
}

// Crawl multiple pages
async function crawlExample() {
  const result = await crawl('https://example.com', {
    maxPages: 10,
    maxDepth: 3
  });
  
  console.log(`Pages scanned: ${result.totalPagesScanned}`);
  console.log(`Average score: ${result.averageScore}`);
  
  // Find pages with low scores
  const problematic = result.pages.filter(p => p.score < 80);
  console.log(`Pages needing attention: ${problematic.length}`);
}
```

### Diff Analysis

```javascript
const { AccessibilityDiffer } = require('a11y-flow/core/Differ');
const fs = require('fs');

async function diffExample() {
  // Load scan results
  const baseline = JSON.parse(fs.readFileSync('baseline.json'));
  const current = JSON.parse(fs.readFileSync('current.json'));
  
  // Perform diff
  const differ = new AccessibilityDiffer();
  const diff = differ.diff(baseline, current);
  
  console.log(`New issues: ${diff.summary.totalNew}`);
  console.log(`Fixed issues: ${diff.summary.totalFixed}`);
  console.log(`Score change: ${diff.scoreChange}`);
  
  // Check if should pass
  const result = differ.shouldPass(diff, {
    maxNewIssues: 0,
    maxCriticalIssues: 0
  });
  
  if (!result.passed) {
    console.error(`Failed: ${result.reason}`);
    process.exit(1);
  }
  
  // Generate markdown report
  const markdown = differ.formatAsMarkdown(diff, {
    includeDetails: true,
    reportUrl: 'https://example.com/report.html'
  });
  
  fs.writeFileSync('diff-report.md', markdown);
}
```

### Generate Reports

```javascript
const { generateReport } = require('a11y-flow/report');
const fs = require('fs');

async function reportExample() {
  // Load scan data
  const data = JSON.parse(fs.readFileSync('scan-results.json'));
  
  // Generate HTML report
  const html = generateReport(data);
  
  // Save to file
  fs.writeFileSync('report.html', html);
  
  console.log('Report generated: report.html');
}
```

## CI/CD Integration

See the GitHub Actions examples in `.github/workflows/`:

- `a11y-check.yml` - Full PR diff workflow
- `a11y-scheduled.yml` - Scheduled production scans
- `a11y-deploy.yml` - Post-deployment verification

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test

accessibility:
  stage: test
  image: node:20
  script:
    - npm install -g a11y-flow
    - a11y-flow scan $CI_ENVIRONMENT_URL --threshold 80
  only:
    - merge_requests
```

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  a11y-check:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm install -g a11y-flow
      - run: a11y-flow scan https://preview.example.com --fail-on-critical
```

## Advanced Usage

### Custom Device Profiles

```bash
# Mobile scanning
a11y-flow scan https://example.com --device mobile

# Tablet
a11y-flow scan https://example.com --device tablet

# Low vision simulation
a11y-flow scan https://example.com --device low-vision
```

### Integration with Testing Frameworks

```javascript
// Jest integration
describe('Accessibility', () => {
  it('should have no critical issues', async () => {
    const { scan } = require('a11y-flow');
    const result = await scan('http://localhost:3000');
    
    const critical = result.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
  
  it('should maintain score above 80', async () => {
    const { scan } = require('a11y-flow');
    const result = await scan('http://localhost:3000');
    
    expect(result.score).toBeGreaterThanOrEqual(80);
  });
});
```

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Scan staged changes (requires local dev server)
if [ -f "scan-results.json" ]; then
  npm run dev &
  DEV_PID=$!
  sleep 5
  
  a11y-flow scan http://localhost:3000 --output new-scan.json
  a11y-flow diff scan-results.json new-scan.json --max-new-issues 0 --exit-code
  
  RESULT=$?
  kill $DEV_PID
  exit $RESULT
fi
```

## Troubleshooting

### Common Issues

**Error: "Cannot find module"**
- Ensure a11y-flow is installed: `npm install -g a11y-flow`
- Check Node.js version: `node --version` (requires 18+)

**Timeout errors**
- Increase timeout: `a11y-flow scan https://slow-site.com --timeout 60000`
- Check network connectivity

**Empty reports**
- Verify URL is accessible
- Check for authentication requirements
- Try with `--debug` flag for detailed logs

## More Examples

See the `examples/` directory for:
- `github-actions.md` - GitHub Actions integration
- `vercel-integration.md` - Vercel deployment checks
- `slack-notifications.md` - Slack webhook integration
- `jira-integration.md` - Create Jira tickets from violations
