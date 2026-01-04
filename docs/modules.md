# Module Reference

## Core Modules

### utils.js

Shared utility functions used across all components.

**Functions:**

- `escapeHtml(text)` - Sanitizes text for safe HTML rendering
  - Escapes: `<`, `>`, `&`, `"`, `'`
  - Returns empty string for null/undefined
  - Example: `escapeHtml('<script>')` returns `&lt;script&gt;`

- `formatMs(ms)` - Formats milliseconds for display
  - Returns "N/A" for null/undefined
  - Adds "ms" suffix
  - Example: `formatMs(1234)` returns `"1234ms"`

- `formatNumber(num)` - Formats numbers with commas
  - Returns "0" for null/undefined
  - Adds thousand separators
  - Example: `formatNumber(1234567)` returns `"1,234,567"`

- `getPerformanceRating(metric, value)` - Determines performance rating
  - Returns: `'good'`, `'needs-improvement'`, or `'poor'`
  - Thresholds defined per metric (LCP, FCP, CLS, etc.)

**Usage Example:**
```javascript
const { escapeHtml, formatMs } = require('./utils');
const safeText = escapeHtml(userInput);
const duration = formatMs(1800);
```

### styles.js

CSS styles with theme support and responsive design.

**Features:**

- Theme Variables
  - Dark mode (default): Dark blue backgrounds, light text
  - Light mode: White backgrounds, dark text
  - Smooth transitions between themes

- Custom Scrollbar
  - Themed track and thumb
  - Rounded corners
  - Hover effects

- Responsive Design
  - Mobile-first approach
  - Breakpoints for tablet/desktop
  - Touch-friendly controls

- Print Styles
  - Black text on white background
  - Hidden interactive elements
  - Optimized layout

**Theme Variables:**
```css
--bg-primary: Background color
--bg-secondary: Card backgrounds
--bg-tertiary: Hover states
--text-primary: Main text
--text-secondary: Secondary text
--text-tertiary: Muted text
--border-color: Borders and dividers
```

### scripts.js

Interactive JavaScript functionality.

**Functions:**

- `initTheme()` - Loads theme preference from localStorage
- `toggleTheme()` - Switches between light/dark mode
- `updateThemeIcon(theme)` - Updates toggle button icon
- `switchTab(tabId)` - Changes active content tab
- `sortPages(sortBy)` - Sorts crawl pages by criteria
- `togglePageDetail(pageIndex)` - Expands/collapses page details
- `toggleIssueDetails(id)` - Shows/hides violation details

**Event Listeners:**
- `DOMContentLoaded` - Initializes theme and first tab
- `keydown` - ESC key closes modals

**Usage:**
All functions are globally accessible via inline script tags. No module imports required in browser context.

## Layout Components

### header.js

Report header with metadata and theme toggle.

**Input:**
```javascript
{
  data: {
    url: 'https://example.com',
    rootUrl: 'https://example.com', // crawl mode
    averageScore: 82, // crawl mode
    score: 90, // single-page mode
    pages: [...] // crawl mode
  },
  isCrawl: boolean
}
```

**Output:**
HTML string containing:
- Theme toggle button
- Report title
- Target URL (clickable link)
- Generation timestamp
- Page count (crawl mode only)
- Score visualization (circular progress)

### sidebar.js

Navigation menu with tab buttons.

**Input:**
```javascript
{
  stats: {
    critical: 5,
    serious: 10,
    moderate: 3,
    minor: 2
  },
  isCrawl: boolean
}
```

**Output:**
HTML string containing:
- Overview tab (always visible)
- Performance tab (conditionally visible)
- Structure tab (heading analysis)
- Issue count badges

**Behavior:**
- Active tab highlighted
- Click switches content section
- Badge shows total issue count

## Content Components

### summary-single.js

Overview for single-page scans.

**Input:**
```javascript
{
  data: {
    score: 90,
    violations: [...],
    violationsArray: [...] // flattened
  },
  stats: {
    critical: 1,
    serious: 2,
    moderate: 1,
    minor: 0,
    total: 4
  }
}
```

**Output:**
- Four statistics cards (Critical, Serious, Other, Score)
- Top 5 issues preview
- Message when no violations found

### summary-crawl.js

Overview for multi-page scans with sorting.

**Input:**
```javascript
{
  data: {
    pages: [
      {
        url: 'https://example.com/page1',
        score: 90,
        violations: [...],
        performance: {...},
        headingStructure: {...}
      }
    ]
  }
}
```

**Output:**
- Aggregate statistics cards
- Sort dropdown (6 options)
- Page list with preview cards
- "View Detail" buttons

**Sort Options:**
1. Default Order
2. Score: Low to High
3. Score: High to Low
4. Most Issues First
5. Fewest Issues First
6. Most Critical Issues

**Client-Side Functions:**
- `sortPages(sortBy)` - Reorders page list
- `generatePageListItemHTML(page, index)` - Renders page card

### performance.js

Core Web Vitals and Navigation Timing display.

**Input:**
```javascript
{
  data: {
    performance: {
      coreWebVitals: {
        lcp: 1800,
        cls: 0.05,
        tbt: 150
      },
      navigation: {
        firstContentfulPaint: 1200,
        timeToFirstByte: 300
      }
    }
  },
  isCrawl: boolean
}
```

**Metrics:**
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- TBT (Total Blocking Time)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)

**Rating Thresholds:**
- Good: Green badge
- Needs Improvement: Yellow badge
- Poor: Red badge

**Backward Compatibility:**
Supports both nested and flat data structures.

### heading-structure.js

H1-H6 hierarchy analysis and visualization.

**Input:**
```javascript
{
  data: {
    headingStructure: {
      headings: [
        { level: 1, text: 'Title', selector: 'h1' }
      ],
      detections: [
        { type: 'missing-h1', message: '...' }
      ]
    }
  },
  isCrawl: boolean
}
```

**Detection Types:**
1. missing-h1 - No H1 on page
2. multiple-h1 - More than one H1
3. skipped-level - H3 without H2
4. empty-heading - Heading with no text
5. first-not-h1 - First heading is not H1
6. duplicate-headings - Identical heading text
7. generic-heading - Generic text like "Title"
8. very-long-heading - Over 100 characters
9. very-short-heading - Under 3 characters

**Output:**
- H1-H6 count badges
- Detection list with explanations
- Hierarchical heading tree
- Educational content

### page-modal.js

Full-screen modal for detailed page analysis (crawl mode only).

**Functions:**

- `generatePageModal()` - Returns modal HTML structure
- `generateModalScripts(pagesData)` - Returns JavaScript for modal
- `openPageModal(pageIndex)` - Shows modal with page data
- `closePageModal()` - Hides modal
- `switchModalTab(tabId)` - Changes active modal tab
- `generatePageModalContent(page)` - Renders modal content
- `generateModalSummaryTab(page, stats)` - Summary statistics
- `generateModalViolationsTab(page)` - Violation list
- `generateModalPerformanceTab(page)` - Performance metrics
- `generateModalStructureTab(page)` - Heading structure

**Modal Structure:**
- Header with URL and close button
- Sidebar with 4 tabs
- Content area (scrollable)
- Dark overlay background

**Tabs:**
1. Summary - Quick stats and top issues
2. Violations - Full violation list
3. Performance - Core Web Vitals
4. Heading Structure - H1-H6 analysis

**Features:**
- ESC key to close
- Click outside to close
- Keyboard navigation
- Screen reader accessible

## Integration Example

```javascript
const fs = require('fs');
const { escapeHtml } = require('./report-modules/utils');
const generateHeader = require('./report-modules/header');
const generateSidebar = require('./report-modules/sidebar');
const generateSummary = require('./report-modules/summary-single');

// Load data
const data = JSON.parse(fs.readFileSync('scan.json', 'utf-8'));

// Calculate stats
const stats = {
  critical: data.violations.filter(v => v.impact === 'critical').length,
  serious: data.violations.filter(v => v.impact === 'serious').length,
  // ...
};

// Generate components
const header = generateHeader(data, false);
const sidebar = generateSidebar(stats, false);
const summary = generateSummary(data, stats);

// Assemble HTML
const html = `<!DOCTYPE html>
<html>
<head>
  <title>Report</title>
  ${styles}
</head>
<body>
  ${header}
  ${sidebar}
  ${summary}
  ${scripts}
</body>
</html>`;

// Write output
fs.writeFileSync('report.html', html);
```
