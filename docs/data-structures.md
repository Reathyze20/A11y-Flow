# Data Structures

## Overview

The report generator accepts JSON files in two formats: single-page and multi-page (crawl). Both formats share common fields but differ in structure and nesting.

## Single-Page Format

### Root Structure

```json
{
  "url": "https://example.com",
  "score": 85,
  "violations": [...],
  "performance": {...},
  "headingStructure": {...},
  "timestamp": "2026-01-04T10:30:00.000Z"
}
```

### Field Descriptions

**url** (string, required)
- The URL of the scanned page
- Must be a valid HTTP(S) URL
- Used in report header and metadata

**score** (number, required)
- Accessibility score from 0-100
- Calculated based on violation severity and count
- Displayed in circular progress visualization

**violations** (array or object, optional)
- List of accessibility violations found
- Can be flat array or grouped by severity
- See Violations Structure section below

**performance** (object, optional)
- Core Web Vitals and Navigation Timing metrics
- See Performance Structure section below

**headingStructure** (object, optional)
- Heading hierarchy analysis
- See Heading Structure section below

**timestamp** (string, optional)
- ISO 8601 timestamp of scan
- Used for report metadata

### Violations Structure

**Array Format:**
```json
{
  "violations": [
    {
      "id": "image-alt",
      "impact": "critical",
      "title": "Images must have alternate text",
      "description": "Ensures <img> elements have alt text",
      "help": "Images must have alternate text",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.0/image-alt",
      "tags": ["wcag2a", "wcag111", "cat.text-alternatives"],
      "nodes": [
        {
          "html": "<img src=\"logo.png\">",
          "target": ["#header img"],
          "failureSummary": "Fix: Add alt attribute",
          "impact": "critical"
        }
      ]
    }
  ]
}
```

**Object Format (Grouped by Severity):**
```json
{
  "violations": {
    "critical": [
      {
        "id": "image-alt",
        "title": "Images must have alternate text",
        ...
      }
    ],
    "serious": [...],
    "moderate": [...],
    "minor": [...]
  }
}
```

**Violation Fields:**

- **id** (string) - Unique identifier for the rule
- **impact** (string) - Severity level: critical, serious, moderate, minor
- **title** (string) - Short human-readable description
- **description** (string) - Detailed explanation of the issue
- **help** (string) - How to fix the issue
- **helpUrl** (string) - Link to documentation
- **tags** (array) - WCAG criteria and categories
- **nodes** (array) - Specific elements with violations

**Node Fields:**

- **html** (string) - Violating element's HTML
- **target** (array) - CSS selector path to element
- **failureSummary** (string) - How to fix this instance
- **impact** (string) - Instance-specific severity

### Performance Structure

**Nested Format (Recommended):**
```json
{
  "performance": {
    "coreWebVitals": {
      "lcp": 1800,
      "cls": 0.05,
      "tbt": 150
    },
    "navigation": {
      "firstContentfulPaint": 1200,
      "timeToFirstByte": 300
    }
  }
}
```

**Flat Format (Legacy):**
```json
{
  "performance": {
    "lcp": 1800,
    "cls": 0.05,
    "tbt": 150,
    "fcp": 1200,
    "ttfb": 300
  }
}
```

**Metric Descriptions:**

- **lcp** (number) - Largest Contentful Paint in milliseconds
- **cls** (number) - Cumulative Layout Shift score (0-1)
- **tbt** (number) - Total Blocking Time in milliseconds
- **fcp** (number) - First Contentful Paint in milliseconds
- **ttfb** (number) - Time to First Byte in milliseconds

**Rating Thresholds:**

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP    | <= 2500ms | <= 4000ms | > 4000ms |
| CLS    | <= 0.1 | <= 0.25 | > 0.25 |
| TBT    | <= 300ms | <= 600ms | > 600ms |
| FCP    | <= 1800ms | <= 3000ms | > 3000ms |
| TTFB   | <= 800ms | <= 1800ms | > 1800ms |

### Heading Structure

```json
{
  "headingStructure": {
    "headings": [
      {
        "level": 1,
        "text": "Main Title",
        "selector": "h1"
      },
      {
        "level": 2,
        "text": "Section Title",
        "selector": "#content h2"
      }
    ],
    "detections": [
      {
        "type": "missing-h1",
        "message": "Page has no H1 heading. Every page should have exactly one main heading.",
        "wcagReference": "2.4.6 Headings and Labels"
      }
    ]
  }
}
```

**Heading Fields:**

- **level** (number or string) - Heading level 1-6 or "H1"-"H6"
- **text** (string) - Text content of the heading
- **selector** (string) - CSS selector to locate the heading

**Detection Types:**

1. **missing-h1** - No H1 on page
2. **multiple-h1** - More than one H1
3. **skipped-level** - Heading level skipped (e.g., H1 to H3)
4. **empty-heading** - Heading with no text content
5. **first-not-h1** - First heading is not H1
6. **duplicate-headings** - Multiple headings with identical text
7. **generic-heading** - Generic text like "Title" or "Heading"
8. **very-long-heading** - Heading over 100 characters
9. **very-short-heading** - Heading under 3 characters

**Detection Fields:**

- **type** (string) - Detection identifier
- **message** (string) - Human-readable explanation
- **wcagReference** (string, optional) - WCAG criterion

## Multi-Page (Crawl) Format

### Root Structure

```json
{
  "rootUrl": "https://example.com",
  "averageScore": 82,
  "totalPagesScanned": 5,
  "totalViolations": 23,
  "totalCriticalViolations": 3,
  "timestamp": "2026-01-04T10:30:00.000Z",
  "pages": [...]
}
```

### Field Descriptions

**rootUrl** (string, required)
- Base URL of the crawled website
- Used in report header

**averageScore** (number, required)
- Average accessibility score across all pages
- Calculated as mean of all page scores

**totalPagesScanned** (number, required)
- Number of pages in the crawl
- Displayed in report metadata

**totalViolations** (number, optional)
- Total number of violations across all pages

**totalCriticalViolations** (number, optional)
- Count of critical violations across all pages

**pages** (array, required)
- List of scanned pages
- Each page follows single-page structure

### Page Structure

Each item in the pages array has the same structure as a single-page report:

```json
{
  "pages": [
    {
      "url": "https://example.com/",
      "score": 90,
      "violations": [...],
      "performance": {...},
      "headingStructure": {...}
    },
    {
      "url": "https://example.com/about",
      "score": 75,
      "violations": [...],
      "performance": {...},
      "headingStructure": {...}
    }
  ]
}
```

## Validation

### Required Fields

**Single-Page:**
- url (string)
- score (number, 0-100)

**Crawl:**
- rootUrl (string)
- averageScore (number, 0-100)
- pages (array, non-empty)

### Optional Fields

All other fields are optional but recommended for full functionality:
- Without violations: No issue list displayed
- Without performance: Performance tab hidden
- Without headingStructure: Structure tab hidden

### Data Types

- Strings: Must be valid UTF-8
- Numbers: Must be finite (no NaN or Infinity)
- Arrays: Can be empty
- Objects: Can have additional properties (ignored)

### Backward Compatibility

The generator supports multiple data formats:

1. **Violations as array** (original format)
2. **Violations as object** (grouped by severity)
3. **Flat performance metrics** (legacy)
4. **Nested performance metrics** (current)
5. **Heading level as number** (1-6)
6. **Heading level as string** ("H1"-"H6")

## Example Files

### Minimal Single-Page

```json
{
  "url": "https://example.com",
  "score": 95,
  "violations": []
}
```

### Minimal Crawl

```json
{
  "rootUrl": "https://example.com",
  "averageScore": 85,
  "totalPagesScanned": 2,
  "pages": [
    {
      "url": "https://example.com/",
      "score": 90,
      "violations": []
    },
    {
      "url": "https://example.com/about",
      "score": 80,
      "violations": []
    }
  ]
}
```

### Complete Example

See test-crawl-real.json in the project root for a complete working example with all fields populated.

## Schema Evolution

### Adding New Fields

New fields can be added without breaking existing reports:
- Add field to data structure
- Update module to render new field
- Provide default value for missing field
- Document in this file

### Deprecating Fields

To deprecate a field:
1. Mark as deprecated in documentation
2. Support for 2 major versions
3. Log warning when detected
4. Remove in future version

### Version Compatibility

Current version: 2.0

Supported input versions:
- 1.x (legacy format with flat structure)
- 2.x (current format with nested structure)

Future versions will maintain backward compatibility with version 2.x format.
