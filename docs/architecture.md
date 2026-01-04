# Architecture Overview

## System Design

The HTML report generator follows a modular architecture where each component is responsible for a specific aspect of the report generation. This design promotes maintainability, testability, and reusability.

## Core Principles

### Single Responsibility
Each module handles one specific concern:
- Layout components manage structure
- Content components render data
- Utility modules provide shared functionality

### Separation of Concerns
- Business logic is separated from presentation
- Styling is centralized in dedicated modules
- Interactive behavior is isolated in script modules

### Progressive Enhancement
- Reports work without JavaScript (static HTML)
- JavaScript adds interactivity (sorting, filtering, modals)
- Theme preferences persist across sessions

## Architecture Layers

### 1. Data Layer
Input JSON files containing scan results:
- Single-page scans
- Multi-page crawl results
- Performance metrics
- Heading structure analysis

### 2. Processing Layer
Main generator (`generate-html-report-v2.js`):
- Detects scan mode (single vs crawl)
- Calculates aggregate statistics
- Orchestrates module execution
- Assembles final HTML output

### 3. Presentation Layer
Modular components (`report-modules/`):
- Core utilities (formatting, escaping)
- Layout structure (header, sidebar)
- Content rendering (summary, performance, structure)
- Styling and interactivity

### 4. Output Layer
Generated HTML files:
- Self-contained (no external dependencies)
- Responsive design
- Print-friendly
- Accessible (WCAG 2.1 AA)

## Module Dependencies

```
generate-html-report-v2.js
├── utils.js (shared by all modules)
├── styles.js
├── scripts.js
├── header.js
│   └── utils.js
├── sidebar.js
│   └── utils.js
├── summary-single.js
│   └── utils.js
└── summary-crawl.js
    ├── utils.js
    └── page-modal.js
        ├── utils.js
        ├── performance.js
        └── heading-structure.js
```

## Data Flow

1. User runs generator with JSON input file
2. Generator reads and validates JSON structure
3. Mode detection (single-page vs crawl)
4. Statistics calculation based on mode
5. Module orchestration:
   - Import required modules
   - Pass data to each module
   - Collect HTML fragments
6. HTML assembly:
   - Inject styles
   - Inject content
   - Inject scripts
7. Write output HTML file

## Rendering Strategy

### Server-Side Generation
All HTML is generated server-side (Node.js):
- No runtime dependencies
- Fast initial render
- SEO-friendly
- Works without JavaScript

### Client-Side Enhancement
JavaScript adds functionality:
- Theme switching
- Tab navigation
- Page sorting/filtering
- Modal interactions

### Hybrid Approach for Crawl Mode
- Initial page list rendered server-side
- Sorting/filtering runs client-side
- Modal content generated on-demand

## Extension Points

### Adding New Modules
1. Create module file in `report-modules/`
2. Export function returning HTML string
3. Import in main generator
4. Add to orchestration logic

### Adding New Themes
1. Define CSS variables in `styles.js`
2. Add theme detection logic in `scripts.js`
3. Update color mappings

### Adding New Metrics
1. Update data structure types
2. Add rendering logic to appropriate module
3. Update documentation

## Performance Considerations

### Bundle Size
- No external dependencies (except runtime Node.js)
- Inline all CSS and JavaScript
- Efficient string concatenation

### Rendering Performance
- Minimal DOM manipulation
- CSS-based animations
- Lazy rendering for modals

### Memory Management
- Stream processing for large datasets
- Efficient string building
- No memory leaks in event handlers

## Error Handling

### Input Validation
- Check JSON structure before processing
- Provide fallback values for missing data
- Graceful degradation for incomplete data

### Runtime Errors
- Try-catch blocks for critical operations
- Error messages in console
- Continue processing when possible

### Output Validation
- Ensure valid HTML structure
- Escape user-generated content
- Validate file write operations

## Security Considerations

### Input Sanitization
- Escape all HTML special characters
- Prevent XSS through content injection
- Validate URLs before rendering

### No External Requests
- Self-contained reports
- No CDN dependencies
- No tracking or analytics

### Safe Defaults
- Secure CSP-compatible output
- No inline event handlers (use addEventListener)
- Proper encoding for all content
