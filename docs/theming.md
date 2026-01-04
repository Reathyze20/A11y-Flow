# Theming System

## Overview

The report generator includes a flexible theming system that supports light and dark modes. Theme preferences are persisted in browser localStorage for a consistent user experience.

## Architecture

### CSS Variables

All colors and theme-specific values are defined using CSS custom properties (variables). This allows dynamic theme switching without reloading the page.

### Theme Definition

Themes are defined in styles.js using CSS variable declarations:

```css
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  /* ... */
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  /* ... */
}
```

## Theme Variables

### Color Variables

**Background Colors:**
- `--bg-primary` - Main background color
- `--bg-secondary` - Card and panel backgrounds
- `--bg-tertiary` - Hover states and accents

**Text Colors:**
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text (labels, metadata)
- `--text-tertiary` - Muted text (hints, timestamps)

**UI Colors:**
- `--border-color` - Borders and dividers
- `--scrollbar-track` - Scrollbar background
- `--scrollbar-thumb` - Scrollbar handle

### Semantic Colors

These remain consistent across themes:
- Brand blue: `#2563eb`
- Success green: `#10b981`
- Warning orange: `#f59e0b`
- Danger red: `#ef4444`
- Info blue: `#3b82f6`

## Theme Values

### Dark Mode (Default)

```css
--bg-primary: #0f172a;      /* Deep navy blue */
--bg-secondary: #1e293b;     /* Slightly lighter blue */
--bg-tertiary: #334155;      /* Medium blue-gray */
--text-primary: #f1f5f9;     /* Almost white */
--text-secondary: #cbd5e1;   /* Light gray */
--text-tertiary: #94a3b8;    /* Medium gray */
--border-color: #475569;     /* Blue-gray */
--scrollbar-track: #1e293b;  /* Matches secondary bg */
--scrollbar-thumb: #475569;  /* Matches border */
```

### Light Mode

```css
--bg-primary: #ffffff;       /* Pure white */
--bg-secondary: #f8fafc;     /* Very light gray */
--bg-tertiary: #e2e8f0;      /* Light gray */
--text-primary: #0f172a;     /* Dark navy */
--text-secondary: #334155;   /* Medium gray */
--text-tertiary: #64748b;    /* Blue-gray */
--border-color: #cbd5e1;     /* Light border */
--scrollbar-track: #e2e8f0;  /* Light track */
--scrollbar-thumb: #94a3b8;  /* Medium thumb */
```

## Usage in Components

### Applying Theme Variables

Use CSS variables in component styles:

```css
.component {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.component:hover {
  background-color: var(--bg-tertiary);
}
```

### Tailwind Overrides

Theme variables override Tailwind utility classes:

```css
.bg-cardDark {
  background-color: var(--bg-secondary) !important;
}

.text-white {
  color: var(--text-primary) !important;
}
```

## Theme Switching

### Toggle Button

Located in the header component:

```html
<button onclick="toggleTheme()">
  <i id="theme-icon" class="fas fa-sun"></i>
</button>
```

**Icon Changes:**
- Dark mode: Sun icon (fa-sun, yellow)
- Light mode: Moon icon (fa-moon, blue)

### JavaScript Functions

**Initialize Theme:**
```javascript
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}
```

**Toggle Theme:**
```javascript
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}
```

**Update Icon:**
```javascript
function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (theme === 'dark') {
    icon.className = 'fas fa-sun text-yellow-400';
  } else {
    icon.className = 'fas fa-moon text-blue-600';
  }
}
```

### Storage

Theme preference is stored in browser localStorage:
- Key: `'theme'`
- Values: `'dark'` or `'light'`
- Persists across page reloads
- Separate per origin (domain)

## Adding New Themes

### 1. Define Theme Variables

Add new theme selector in styles.js:

```css
[data-theme="high-contrast"] {
  --bg-primary: #000000;
  --bg-secondary: #1a1a1a;
  --text-primary: #ffffff;
  --border-color: #ffffff;
  /* ... */
}
```

### 2. Update Theme Toggle

Modify toggleTheme() to cycle through themes:

```javascript
function toggleTheme() {
  const themes = ['dark', 'light', 'high-contrast'];
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const currentIndex = themes.indexOf(current);
  const newTheme = themes[(currentIndex + 1) % themes.length];
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}
```

### 3. Update Icon Logic

Add icon for new theme:

```javascript
function updateThemeIcon(theme) {
  const icons = {
    'dark': 'fa-sun text-yellow-400',
    'light': 'fa-moon text-blue-600',
    'high-contrast': 'fa-adjust text-purple-400'
  };
  document.getElementById('theme-icon').className = `fas ${icons[theme]}`;
}
```

## Accessibility Considerations

### Color Contrast

All theme colors meet WCAG 2.1 AA contrast requirements:
- Text on background: 4.5:1 minimum
- Large text on background: 3:1 minimum
- Interactive elements: 3:1 minimum

### Testing Contrast

Use browser dev tools to verify contrast ratios:
1. Inspect element
2. Check computed styles
3. View contrast ratio in color picker

Online tools:
- WebAIM Contrast Checker
- Accessible Colors
- Contrast Ratio Calculator

### Focus Indicators

Focus outlines remain visible in all themes:

```css
*:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

### Prefers Color Scheme

Respect user's OS theme preference:

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    /* Apply light theme variables */
  }
}
```

## Print Styles

Override theme for printing:

```css
@media print {
  body {
    background-color: white !important;
    color: black !important;
  }
  
  .bg-cardDark,
  .bg-bgDark {
    background-color: white !important;
    border: 1px solid #ddd;
  }
  
  .text-gray-400,
  .text-gray-300 {
    color: #666 !important;
  }
}
```

## Customization Guide

### Brand Colors

To use company brand colors:

1. Define brand variables:
```css
:root {
  --brand-primary: #your-color;
  --brand-secondary: #your-color;
}
```

2. Apply to components:
```css
.brand-element {
  background-color: var(--brand-primary);
  color: var(--brand-secondary);
}
```

### Component Theming

Create theme-specific styles for custom components:

```css
.custom-component {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

[data-theme="dark"] .custom-component {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

[data-theme="light"] .custom-component {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Dynamic Styling

Use JavaScript to apply theme-dependent styles:

```javascript
const theme = document.documentElement.getAttribute('data-theme');
const element = document.getElementById('dynamic-element');

if (theme === 'dark') {
  element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
} else {
  element.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
}
```

## Troubleshooting

### Theme Not Applying

1. Check data-theme attribute:
```javascript
console.log(document.documentElement.getAttribute('data-theme'));
```

2. Verify CSS variables are defined:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--bg-primary');
```

3. Check for CSS specificity conflicts

### Theme Not Persisting

1. Check localStorage support:
```javascript
console.log(localStorage.getItem('theme'));
```

2. Verify initTheme() is called on load

3. Check for JavaScript errors preventing storage

### Contrast Issues

1. Test with accessibility tools
2. Adjust variable values
3. Use color contrast calculators
4. Get feedback from users with visual impairments

## Best Practices

1. Use semantic variable names
2. Maintain consistent contrast ratios
3. Test all themes thoroughly
4. Provide clear theme indicators
5. Respect user preferences
6. Document all theme variables
7. Use CSS variables consistently
8. Avoid hardcoded colors
9. Test with screen readers
10. Consider color blindness variations
