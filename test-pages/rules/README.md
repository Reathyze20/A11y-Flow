# Accessibility Rule Unit Tests

This directory contains HTML pages designed to trigger specific accessibility rules in the `a11y-flow` scanner.

## Test Pages

| Page | Rule Tested | Expected Violation |
|------|-------------|-------------------|
| `alt-text.html` | `SuspiciousAltText` | Images with alt text like "image", "picture", or filenames. |
| `autoplay.html` | `AutoplayMedia` | `<video>` or `<audio>` elements with the `autoplay` attribute. |
| `carousel.html` | `CarouselAutoplay` | Carousel components missing pause/stop controls. |
| `focus-order.html` | `FocusOrder` | Elements with positive `tabindex` values (1, 2, 3...). |
| `forms.html` | `FormErrors` | Inputs missing labels, empty labels, duplicate IDs. |
| `landmarks.html` | `Landmarks` | Page content missing semantic landmarks (`<main>`, `<nav>`, etc.). |
| `meta-viewport.html` | `MetaViewport` | Viewport meta tag with `user-scalable=no`. |
| `modal.html` | `ModalFocus` | Dialogs (`role="dialog"`) without `aria-modal="true"`. |
| `orientation.html` | `OrientationLock` | CSS media queries locking orientation. |
| `skip-link.html` | `SkipLink` | Missing "Skip to main content" link at the top of the page. |

## How to Run

You can run the scanner against these pages locally. For example:

```bash
# Run against a specific rule page
ts-node run-local.ts --url http://localhost:8080/test-pages/rules/alt-text.html

# Or if you have a batch runner
node run-flow.js --urls test-pages/rules/index.html
```
