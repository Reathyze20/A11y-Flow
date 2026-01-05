# SPA and Shadow DOM Support

a11y-flow nyní podporuje komplexní skenování Single Page Applications (SPA) a Web Components se Shadow DOM.

## Funkce

### 🚀 SPA Support

- **Framework Detection**: Automatická detekce React, Vue, Angular
- **Hydration Waiting**: Čeká na dokončení hydratace frameworku
- **Stability Detection**: MutationObserver sleduje DOM změny
- **Lazy Loading**: Automatické čekání na lazy-loaded obrázky a iframe
- **Client-Side Routing**: Podpora pro React Router, Vue Router, Next.js
- **Dynamic States**: Testování hover, focus a dalších interaktivních stavů

### 🎯 Shadow DOM Support

- **Deep Traversal**: Rekurzivní procházení všech shadow roots
- **Open & Closed Roots**: Detekce obou typů (s upozorněním na closed)
- **Web Components**: Automatická detekce custom elementů
- **Nested Shadow DOM**: Podpora vnořených shadow roots
- **axe-core Integration**: Nativní Shadow DOM scanning s axe-core 4.8+
- **Element Piercing**: QuerySelector napříč shadow boundaries

## Jak to funguje

### Automatická detekce

Scanner automaticky:

1. **Detekuje SPA framework** - Kontroluje `window.React`, `window.Vue`, `window.ng`
2. **Čeká na hydrataci** - Framework-specific waiting logic
3. **Hledá shadow DOM** - Skenuje všechny elementy s `shadowRoot`
4. **Připravuje scan** - Injektuje axe-core context do shadow roots
5. **Spouští analýzu** - Skenuje včetně shadow DOM obsahu

### Žádná konfigurace

```typescript
// Funguje automaticky - žádná extra konfigurace!
const scanner = new WebScanner();
const report = await scanner.scan('https://your-spa.com');
```

## Framework Hydration

### React

```typescript
// Detekce
window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__

// Čekání
window.requestIdleCallback(() => {
  // React hydration complete
});
```

### Vue

```typescript
// Detekce
window.Vue || window.__VUE__

// Čekání
Vue.nextTick(() => {
  // Vue ready
});
```

### Angular

```typescript
// Detekce
window.ng || window.getAllAngularRootElements()

// Čekání
ng.getTestability(document.body).whenStable(() => {
  // Angular stable
});
```

## Shadow DOM Scanning

### Web Components

```html
<custom-button></custom-button>

<script>
class CustomButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <!-- a11y-flow skenuje i tento obsah! -->
      <button>Click me</button>
    `;
  }
}
customElements.define('custom-button', CustomButton);
</script>
```

### Nested Shadow Roots

```typescript
// a11y-flow automaticky najde všechny úrovně
<parent-component>
  #shadow-root
    <child-component>
      #shadow-root
        <button>Hidden button</button>  ← Detected!
      </shadow-root>
    </child-component>
  </shadow-root>
</parent-component>
```

## Konfigurace axe-core

Scanner automaticky konfiguruje axe-core pro Shadow DOM:

```typescript
const results = await new AxePuppeteer(page)
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .configure({
    shadowDom: true  // ← Automaticky zapnuto
  })
  .analyze();
```

## API Reference

### SPAHandler

```typescript
import { SPAHandler } from './src/core/SPAHandler';

// Manuální použití (obvykle ne nutné)
await SPAHandler.waitForSPAReady(page, 'auto', 10000);
await SPAHandler.exploreDynamicStates(page);
await SPAHandler.waitForLazyContent(page);

// Detekce
const hasRouting = await SPAHandler.hasClientSideRouting(page);
const framework = await SPAHandler.detectFramework(page);
```

### ShadowDOMScanner

```typescript
import { ShadowDOMScanner } from './src/core/ShadowDOMScanner';

// Manuální použití
const hasShadow = await ShadowDOMScanner.hasShadowDOM(page);
const hosts = await ShadowDOMScanner.getShadowHosts(page);
const components = await ShadowDOMScanner.detectWebComponents(page);

// Query across shadow boundaries
const elements = await ShadowDOMScanner.queryAllIncludingShadow(page, 'button');
const element = await ShadowDOMScanner.pierceElementHandle(page, '.my-button');
```

## Testovací stránky

Vytvořili jsme testovací stránky pro ověření funkcionality:

### `test-pages/rules/spa.html`

- React simulace s client-side routingem
- Dynamický obsah
- Lazy loading obrázků
- Form validace
- **Očekávané violations**: Missing labels, empty links, heading structure

### `test-pages/rules/shadow-dom.html`

- Custom Web Components
- Vnořené shadow roots
- Shadow DOM formuláře
- **Očekávané violations**: Missing alt, poor contrast, no labels

## Spuštění testů

```bash
# Kompilace
npm run build

# Spuštění testů
ts-node test-spa-shadow.ts
```

Test spustí lokální server a naskenuje obě testovací stránky.

### Očekávaný výstup

```
✅ Test server started at http://localhost:8080

🧪 Testing SPA Scanning...
============================================================
[SPAHandler] Waiting for SPA framework to be ready...
[SPAHandler] Detected framework: react
[SPAHandler] Page stable after 823ms
[SPAHandler] SPA is ready

📊 SPA Scan Results for http://localhost:8080/spa.html
   Total violations: 15
   Critical: 3
   Serious: 5
   Moderate: 7
   Minor: 0

✅ SPA scanning completed successfully

🧪 Testing Shadow DOM Scanning...
============================================================
[WebScanner] Shadow DOM detected, preparing for scan
[ShadowDOMScanner] Found and prepared 5 shadow root(s)

📊 Shadow DOM Scan Results for http://localhost:8080/shadow-dom.html
   Total violations: 12
   Critical: 2
   Serious: 4
   Moderate: 6
   Minor: 0

✅ Shadow DOM scanning completed successfully

📈 Test Summary
============================================================
SPA Test: 15 violations found
Shadow DOM Test: 12 violations found

✅ Both SPA and Shadow DOM scanning are working correctly!
```

## Performance

### SPA Waiting Strategies

```typescript
// Stability timeout: 5s default
// Checks every 50-100ms
// Requires 500ms stability period

await SPAHandler.waitForStable(page, 5000, 500);
```

### Shadow DOM Traversal

```typescript
// Rekurzivní procházení
// O(n) complexity kde n = počet elementů
// Cached results pro opakované queries
```

## Best Practices

### Pro vývojáře Web Components

1. **Používejte `mode: 'open'`** - Closed shadow roots nelze skenovat
2. **Správné ARIA atributy** - Shadow DOM izoluje context
3. **Delegace focusu** - `delegatesFocus: true` pro lepší klávesnici
4. **Slot names** - Pojmenované sloty pro lepší semantiku

```typescript
// ✅ Dobrý příklad
class AccessibleButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ 
      mode: 'open',           // ← Scannable
      delegatesFocus: true    // ← Better keyboard
    });
  }
  
  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <button 
        aria-label="${this.getAttribute('label')}"
        role="button">
        <slot></slot>
      </button>
    `;
  }
}
```

### Pro SPA vývojáře

1. **Semantic HTML** - I v dynamickém obsahu
2. **ARIA live regions** - Pro dynamické aktualizace
3. **Focus management** - Po navigaci vrátit focus
4. **Loading states** - Indikace loading s ARIA

```typescript
// ✅ Dobrý příklad SPA routingu
function navigateTo(route) {
  // 1. Update ARIA live region
  announcer.textContent = 'Loading...';
  
  // 2. Render content
  renderRoute(route);
  
  // 3. Focus management
  document.querySelector('h1').focus();
  
  // 4. Announce completion
  announcer.textContent = `Loaded ${route}`;
}
```

## Troubleshooting

### "Closed shadow roots detected"

```
[ShadowDOMScanner] Found 2 closed shadow root(s) that cannot be scanned:
  - <custom-element#my-id>
```

**Řešení**: Změňte `mode: 'closed'` na `mode: 'open'` v komponentě.

### "SPA hydration timeout"

```
[SPAHandler] Timeout waiting for stability after 10000ms
```

**Možné příčiny**:
- Nekonečný polling/websocket
- Animace běžící v pozadí
- Memory leak v MutationObserver

**Řešení**: Zvyšte timeout nebo vypněte kontinuální animace.

### "Framework not detected"

Scanner může mít problém s:
- SSR aplikacemi (Next.js, Nuxt)
- Vlastními build systémy
- Obfuskovaným kódem

**Řešení**: Framework detection je optional, stability detection funguje i bez něj.

## Roadmap

- [ ] **Playwright support** - Jako alternativa k Puppeteer
- [ ] **Cypress integration** - Plugin pro Cypress testy
- [ ] **Declarative Shadow DOM** - Support pro `<template shadowroot>`
- [ ] **SPA route mapping** - Automatické skenování všech routes
- [ ] **Iframe traversal** - Podpora vnořených iframe
- [ ] **Performance budgets** - Limits pro SPA hydration time

## Contributing

Pokud najdete SPA framework nebo Web Component library, která nefunguje správně:

1. Vytvořte testovací stránku v `test-pages/rules/`
2. Přidejte test case do `test-spa-shadow.ts`
3. Otevřete issue s reproducible case
4. (Optional) Navrhněte fix v PR

## Odkazy

- [Shadow DOM v1 Spec](https://www.w3.org/TR/shadow-dom/)
- [axe-core Shadow DOM Support](https://github.com/dequelabs/axe-core/blob/develop/doc/shadowdom.md)
- [Web Components Best Practices](https://web.dev/custom-elements-best-practices/)
- [SPA Accessibility Guide](https://www.w3.org/WAI/ARIA/apg/patterns/)
