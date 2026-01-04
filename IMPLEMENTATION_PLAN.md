# Crawl Report Implementation Plan

## Cíl
Umožnit v multi-page crawl reportu rozklikat jednotlivé stránky a zobrazit jejich detail.

## Struktura

### Pro Single Page (aktuální):
- Summary tab → všechny violations jednéstránky
- Performance tab → metriky stránky
- Structure tab → heading structure stránky

### Pro Crawl (nový):
- **Summary tab:**
  - Agregované statistiky nahoře (celkem stránek, celkem issues, atd.)
  - Seznam všech proskenovaných stránek
  - Každá stránka rozklikatelná → zobrazí její violations + performance + structure

- **Performance tab:** Agregované metriky (průměry, grafy)
- **Structure tab:** Agregovaná heading structure (už hotovo ✓)

## Implementace

### 1. Detekce režimu
```js
const isCrawl = Array.isArray(data.pages);
```

### 2. Summary tab content
- If crawl → generateCrawlSummary()
- Else → generateSinglePageSummary() (aktuální)

### 3. generateCrawlSummary()
```
[Aggregate Stats Cards]

[Pages List]
  ├─ Page 1 (collapsed)
  │   └─ [Click] → Expand → Show violations + perf + structure
  ├─ Page 2 (collapsed)
  └─ Page 3 (collapsed)
```

### 4. JavaScript
```js
function togglePageDetail(pageIndex) {
  const detail = document.getElementById(`page-detail-${pageIndex}`);
  const chevron = document.getElementById(`chevron-${pageIndex}`);
  detail.classList.toggle('hidden');
  chevron.classList.toggle('rotate-180');
}
```

## Minimální změny
1. Upravit Summary tab: if (isCrawl) generovat seznam stránek
2. Přidat toggle funkci do JS
3. Performance/Structure tab ponechat s agregací

Hotovo!
