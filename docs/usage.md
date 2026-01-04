# Usage Guide

## Installation

```bash
npm install
```

## Basic Usage

### Generate Report from JSON

```bash
node generate-html-report-v2.js <input.json>
```

The output HTML file will be created in the same directory with the same name as the input file.

**Example:**
```bash
node generate-html-report-v2.js scan-results.json
# Creates: scan-results.html
```

### Single-Page Scan

For a single-page accessibility scan:

```bash
node generate-html-report-v2.js single-page-scan.json
```

Report includes:
- Overview statistics (critical, serious, moderate, minor issues)
- Top 5 issues preview
- Full violation list (if available in sidebar)
- Performance metrics (if available)
- Heading structure analysis (if available)

### Multi-Page Crawl

For multi-page website crawls:

```bash
node generate-html-report-v2.js crawl-results.json
```

Report includes:
- Aggregate statistics across all pages
- Sortable page list with filtering options
- "View Detail" buttons for each page
- Full-screen modal with complete page analysis

## Report Features

### Theme Switching

Toggle between light and dark modes:
- Click the sun/moon icon in the header
- Preference saved in browser localStorage
- Persists across page reloads

### Navigation

Use the sidebar to navigate between sections:
- Overview - Main statistics and issue summary
- Performance - Core Web Vitals and timing metrics
- Structure - Heading hierarchy analysis

### Page Sorting (Crawl Mode)

Sort scanned pages by:
- Default Order - Original scan sequence
- Score: Low to High - Prioritize poorly-rated pages
- Score: High to Low - View best-performing pages
- Most Issues First - Focus on problematic pages
- Fewest Issues First - View cleanest pages
- Most Critical Issues - Prioritize critical violations

### Page Details (Crawl Mode)

Click "View Detail" on any page to open full analysis:
- Summary statistics for that page
- Complete violation list
- Performance metrics
- Heading structure analysis
- Educational content

Press ESC or click the X button to close the modal.

## Command-Line Integration

### Using with npm scripts

Add to package.json:

```json
{
  "scripts": {
    "report": "node generate-html-report-v2.js",
    "report:crawl": "node generate-html-report-v2.js crawl-results.json",
    "report:single": "node generate-html-report-v2.js single-page-scan.json"
  }
}
```

Usage:
```bash
npm run report single-page-scan.json
npm run report:crawl
npm run report:single
```

### Batch Processing

Generate multiple reports:

```bash
for file in scans/*.json; do
  node generate-html-report-v2.js "$file"
done
```

PowerShell:
```powershell
Get-ChildItem scans\*.json | ForEach-Object {
  node generate-html-report-v2.js $_.FullName
}
```

### Automated Workflows

GitHub Actions example:

```yaml
name: Generate Reports
on: [push]
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate HTML Report
        run: node generate-html-report-v2.js scan-results.json
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: accessibility-report
          path: scan-results.html
```

## Advanced Usage

### Custom Output Path

Modify the generator to specify output location:

```javascript
const outputPath = process.argv[3] || inputPath.replace(/\.json$/i, '.html');
fs.writeFileSync(outputPath, html, 'utf-8');
```

Usage:
```bash
node generate-html-report-v2.js input.json output.html
```

### Programmatic Usage

Import and use in Node.js scripts:

```javascript
const fs = require('fs');
const path = require('path');

// Load generator (modify to export main function)
const generateReport = require('./generate-html-report-v2');

// Load scan data
const data = JSON.parse(fs.readFileSync('scan.json', 'utf-8'));

// Generate report
const html = generateReport(data);

// Write to file
fs.writeFileSync('report.html', html, 'utf-8');
console.log('Report generated successfully');
```

### Filtering Data

Pre-process JSON before generating report:

```javascript
const data = JSON.parse(fs.readFileSync('scan.json', 'utf-8'));

// Filter to only critical and serious issues
if (data.violations) {
  data.violations = data.violations.filter(v => 
    v.impact === 'critical' || v.impact === 'serious'
  );
}

// Generate filtered report
const html = generateReport(data);
```

### Custom Branding

Modify styles.js to add custom branding:

```javascript
// Add company logo
const logo = `<img src="company-logo.png" alt="Company Logo">`;

// Add to header.js
const headerHtml = `
  <header>
    ${logo}
    <h1>Accessibility Report</h1>
    ...
  </header>
`;
```

## Viewing Reports

### Local Viewing

Open HTML file directly in browser:
- Double-click the .html file
- Or right-click and "Open with" your browser

### Web Server

Serve reports via HTTP:

```bash
# Python 3
python -m http.server 8000

# Node.js (http-server)
npx http-server

# Open browser
http://localhost:8000/report.html
```

### Print to PDF

Use browser's print function:
1. Open report in browser
2. File > Print (Ctrl/Cmd + P)
3. Select "Save as PDF"
4. Click "Save"

Reports include print-optimized styles.

## Troubleshooting

### "Cannot find module" Error

Ensure you're in the project root directory:
```bash
cd /path/to/a11y-flow
node generate-html-report-v2.js scan.json
```

### Empty or Broken Report

Verify JSON structure:
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('scan.json')))"
```

Check for required fields:
- `url` or `rootUrl`
- `score` or `averageScore`
- `violations` (array or object)

### Styles Not Applied

Check that styles.js is properly loaded:
- Verify file exists in report-modules/
- Check file permissions
- Ensure no syntax errors in styles.js

### JavaScript Errors

Open browser console (F12) to see errors:
- Check that scripts.js loaded correctly
- Verify no conflicting global variables
- Ensure all required functions are defined

## Performance Tips

### Large Crawls

For crawls with 100+ pages:
- Consider pagination in summary-crawl.js
- Lazy-load modal content
- Implement virtual scrolling

### File Size

Optimize output file size:
- Minify inline CSS/JS (optional)
- Remove unused styles
- Compress repeated data structures

### Loading Speed

Improve initial load time:
- Load scripts at end of body
- Use async/defer for non-critical scripts
- Consider code splitting for very large reports
