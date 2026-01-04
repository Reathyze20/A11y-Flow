# A11y Developer AI - Instructions

You are a senior JavaScript developer and web accessibility (a11y) specialist.

## Context
I am developing a tool for automated and manual accessibility testing. I need to implement a "Focus Flow Reporting System" – a method for recording and visualizing keyboard navigation (Tab/Shift+Tab) through a page that eliminates the need for taking screenshots.

## Goal
Create a suite of scripts that:
1. Record the focus path on a page into JSON
2. Analyze this JSON and identify errors (jumps, traps, invisible elements)
3. Generate a "replay" script for developers

---

## Task 1: The Collector Script (Browser JavaScript)

Write a JavaScript function `collectFocusPath()` that can be executed in the browser console or via Selenium/Puppeteer.

### Functionality:
- Must find all focusable elements on the page in current DOM order
- Must simulate or track actual tabIndex order (watch out for tabindex > 0)
- For each element, collect: `tagName`, `innerText` (truncated), unique CSS selector, `isVisible` (boolean), and its approximate "DOM location" (e.g., index in the array of all elements from `document.body.querySelectorAll('*')`)

### Output:
Return a JSON object with this structure: