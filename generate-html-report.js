const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node generate-html-report.js <report.json>');
  console.error('Tip: spouštěj např. přes: npm run report:html -- report-123.json');
  process.exit(1);
}

const inputArg = process.argv[2];
if (!inputArg) usage();

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Input JSON file not found: ${inputPath}`);
  process.exit(1);
}

let data;
try {
  const raw = fs.readFileSync(inputPath, 'utf8');
  data = JSON.parse(raw);
} catch (err) {
  console.error('Failed to read or parse JSON report:', err && err.message ? err.message : err);
  process.exit(1);
}

const isCrawl = Array.isArray(data.pages);

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMs(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Math.round(Number(value))} ms`;
}

function formatNumber(value, decimals) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  const d = typeof decimals === 'number' ? decimals : 2;
  return Number(value).toFixed(d);
}

function normalizeWcagCode(raw) {
  if (!raw) return null;
  const str = String(raw);
  const m = str.match(/(\d\.\d\.\d)/);
  return m ? m[1] : null;
}

const WCAG_LEVELS = {
  '1.1.1': 'A',
  '1.3.1': 'A',
  '1.4.3': 'AA',
  '2.4.1': 'A',
  '2.4.4': 'A',
  '2.4.6': 'AA',
  '2.4.7': 'AA',
  '3.1.1': 'A',
  '3.3.2': 'A',
  '4.1.2': 'A',
};

function getWcagLevel(raw) {
  const code = normalizeWcagCode(raw);
  if (!code) return null;
  return WCAG_LEVELS[code] || null;
}

const IMPACT_WEIGHTS = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
};

const WCAG_LEVEL_WEIGHTS = {
  A: 3,
  AA: 2,
  AAA: 1,
};

function computePriorityScore(item) {
  const impactKey = (item.impact || '').toLowerCase();
  const impactWeight = IMPACT_WEIGHTS[impactKey] || 1;

  const level = getWcagLevel(item.wcagReference);
  const wcagWeight = level ? (WCAG_LEVEL_WEIGHTS[level] || 1) : 1;

  const occurrences = item.occurrences || 1;

  return impactWeight * wcagWeight * Math.max(1, Math.sqrt(occurrences));
}

const WCAG_QUICKREF_BASE = 'https://www.w3.org/WAI/WCAG21/quickref/';
const WCAG_ANCHORS = {
};

function buildWcagLink(code) {
  if (!code) return '';
  const trimmed = String(code).trim();
  const normalized = normalizeWcagCode(trimmed) || trimmed;
  const anchor = WCAG_ANCHORS[normalized];
  const href = anchor ? `${WCAG_QUICKREF_BASE}#${anchor}` : WCAG_QUICKREF_BASE;

  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(normalized)}</a>`;
}

function buildActRuleCell(item) {
  const ids = Array.isArray(item.actRuleIds) ? item.actRuleIds : [];
  const urls = Array.isArray(item.actRuleUrls) ? item.actRuleUrls : [];
  if (!ids.length) return '';

  const id = ids[0];
  const url = urls[0] || '';

  if (url) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(id)}</a>`;
  }

  return escapeHtml(id);
}

function classifyMetric(name, value) {
  if (value == null || Number.isNaN(value)) return '';
  const v = Number(value);

  switch (name) {
    case 'lcp':
      if (v <= 2500) return 'metric-good';
      if (v <= 4000) return 'metric-ok';
      return 'metric-bad';
    case 'cls':
      if (v <= 0.1) return 'metric-good';
      if (v <= 0.25) return 'metric-ok';
      return 'metric-bad';
    case 'inp':
      if (v <= 200) return 'metric-good';
      if (v <= 500) return 'metric-ok';
      return 'metric-bad';
    case 'tbt':
      if (v <= 200) return 'metric-good';
      if (v <= 600) return 'metric-ok';
      return 'metric-bad';
    default:
      return '';
  }
}

function buildPerformanceSummaryHtml(summary) {
  if (!summary) return '';

  if (Array.isArray(summary.pages)) {
    const s = summary.performanceSummary;
    if (!s) return '';

    const lcpClass = classifyMetric('lcp', s.averageLcp);
    const clsClass = classifyMetric('cls', s.averageCls);
    const inpClass = classifyMetric('inp', s.averageInp);
    const tbtClass = classifyMetric('tbt', s.averageTbt);

    return `
    <div class="summary-item">
      <div class="summary-label">Průměrné LCP</div>
      <div class="summary-value ${lcpClass}">${s.averageLcp != null ? formatMs(s.averageLcp) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Průměrné CLS</div>
      <div class="summary-value ${clsClass}">${s.averageCls != null ? formatNumber(s.averageCls, 3) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Průměrné INP</div>
      <div class="summary-value ${inpClass}">${s.averageInp != null ? formatMs(s.averageInp) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Průměrné TBT</div>
      <div class="summary-value ${tbtClass}">${s.averageTbt != null ? formatMs(s.averageTbt) : '-'}</div>
    </div>`;
  }

  const perf = summary.performance;
  if (!perf) return '';

  const cw = perf.coreWebVitals || {};

  const lcpClass = classifyMetric('lcp', cw.lcp);
  const clsClass = classifyMetric('cls', cw.cls);
  const inpClass = classifyMetric('inp', cw.inp);
  const tbtClass = classifyMetric('tbt', cw.tbt);

  return `
    <div class="summary-item">
      <div class="summary-label">LCP</div>
      <div class="summary-value ${lcpClass}">${cw.lcp != null ? formatMs(cw.lcp) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">CLS</div>
      <div class="summary-value ${clsClass}">${cw.cls != null ? formatNumber(cw.cls, 3) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">INP</div>
      <div class="summary-value ${inpClass}">${cw.inp != null ? formatMs(cw.inp) : '-'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">TBT</div>
      <div class="summary-value ${tbtClass}">${cw.tbt != null ? formatMs(cw.tbt) : '-'}</div>
    </div>`;
}

function buildExecutiveStatusHtml(summary) {
  const crawl = Array.isArray(summary.pages);

  const score = crawl ? (summary.averageScore ?? null) : (summary.score ?? null);
  const totalViolations = crawl
    ? (summary.totalViolations ?? 0)
    : (summary.stats ? summary.stats.totalViolations : 0);
  const critical = crawl
    ? (summary.totalCriticalViolations ?? 0)
    : (summary.stats ? summary.stats.criticalCount : 0);

  let label = 'V dobrém stavu';
  let cls = 'status-good';
  let desc = 'Jen menší přístupnostní nedostatky, zaměřte se na průběžné ladění.';

  if ((score != null && score < 50) || critical > 0) {
    label = 'Rizikový stav';
    cls = 'status-bad';
    desc = 'Web má vážnější přístupnostní problémy, které mohou ovlivňovat uživatele i právní shodu.';
  } else if (score != null && score < 80) {
    label = 'Potřebuje zlepšení';
    cls = 'status-warn';
    desc = 'Přístupnost je částečně vyřešená, ale stále je prostor na zásadní zlepšení.';
  }

  const meta = [];
  if (score != null) meta.push(`Skóre: ${score} / 100`);
  if (totalViolations != null) meta.push(`Chyb: ${totalViolations}`);
  if (critical != null) meta.push(`Kritické: ${critical}`);

  return `
    <div class="summary-item summary-status">
      <div class="summary-label">Stav webu</div>
      <div class="summary-value ${cls}">${label}</div>
      <div class="muted">${escapeHtml(desc)}</div>
      <div class="muted">${escapeHtml(meta.join(' · '))}</div>
    </div>`;
}

function buildWcagLevelSummaryHtml(items) {
  if (!items || items.length === 0) return '';

  const counts = { A: 0, AA: 0, AAA: 0 };
  const byCriterion = new Map();

  for (const item of items) {
    const level = getWcagLevel(item.wcagReference);
    if (!level) continue;
    counts[level] += 1;

    const code = normalizeWcagCode(item.wcagReference) || item.wcagReference;
    if (!code) continue;
    if (!byCriterion.has(code)) {
      byCriterion.set(code, { level, count: 1 });
    } else {
      byCriterion.get(code).count += 1;
    }
  }

  const totalCount = counts.A + counts.AA + counts.AAA;
  if (totalCount === 0) return '';

  const top = Array.from(byCriterion.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([code, info]) => `${code} (${info.count}×)`);

  return `
    <div class="summary-item">
      <div class="summary-label">WCAG úrovně</div>
      <div class="summary-value">
        A: ${counts.A} · AA: ${counts.AA} · AAA: ${counts.AAA}
      </div>
      <div class="muted">Nejčastější kritéria: ${escapeHtml(top.join(', ') || '-')}</div>
    </div>`;
}

function buildActSummaryHtml(items) {
  if (!items || items.length === 0) return '';

  const byAct = new Map();

  for (const item of items) {
    if (!Array.isArray(item.actRuleIds) || item.actRuleIds.length === 0) continue;
    const id = item.actRuleIds[0];
    const url = Array.isArray(item.actRuleUrls) && item.actRuleUrls.length > 0 ? item.actRuleUrls[0] : '';

    if (!id) continue;

    if (!byAct.has(id)) {
      byAct.set(id, { id, url, count: 0 });
    }
    byAct.get(id).count += item.occurrences || 1;
  }

  if (byAct.size === 0) return '';

  const top = Array.from(byAct.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((r) => {
      const label = escapeHtml(r.id);
      const count = r.count;
      if (r.url) {
        return `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${label}</a> (${count}×)`;
      }
      return `${label} (${count}×)`;
    })
    .join(', ');

  return `
    <div class="summary-item">
      <div class="summary-label">ACT pravidla (top)</div>
      <div class="summary-value">${byAct.size}</div>
      <div class="muted">Nejčastější ACT pravidla: ${top || '-'}</div>
    </div>`;
}

function buildQuickWinsHtml(items) {
  if (!items || items.length === 0) return '';

  const candidates = items.filter((item) => {
    const impactKey = (item.impact || '').toLowerCase();
    const isHighImpact = impactKey === 'critical' || impactKey === 'serious' || impactKey === 'moderate';
    const occ = item.occurrences || 1;
    return isHighImpact && occ <= 5;
  });

  if (candidates.length === 0) return '';

  const sorted = candidates
    .slice()
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
    .slice(0, 5);

  const itemsHtml = sorted
    .map((it) => {
      const pageUrl = it.pageUrl || it.exampleUrl || '';
      const wcag = it.wcagReference || '';
      const wcagCell = wcag ? buildWcagLink(wcag) : '';
      const selector = it.exampleTarget || '';
      return `<li>
        <strong>${escapeHtml(it.what || '')}</strong>
        ${pageUrl ? ` – <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageUrl)}</a>` : ''}
        ${selector ? `<span class="muted"> · Selector: ${escapeHtml(selector)}</span>` : ''}
        <span class="muted"> (${escapeHtml(it.priority || '')} · ${it.occurrences || 1}× · ${wcagCell || 'WCAG ?'})</span>
      </li>`;
    })
    .join('');

  if (!itemsHtml) return '';

  return `
    <div class="quick-wins">
      <h2>Rychlé výhry – doporučené první kroky</h2>
      <p class="muted">Problémy s vysokým dopadem na uživatele, které často stačí opravit na jednotkách prvků.</p>
      <ul>
        ${itemsHtml}
      </ul>
    </div>`;
}

// Element-first pohled je primárně řešen v hlavní tabulce přes sloupce
// „Element“ a „Selector“. Další agregovanou tabulku problémových prvků
// záměrně neukazujeme, aby report zůstal stručný a nepřekrýval informace.

const KEYBOARD_TYPE_LABELS = {
  'focus-lost': 'Ztráta focusu',
  'focus-loop': 'Focus loop / past',
  'no-visible-focus': 'Bez viditelného focusu',
  'no-focusable-elements': 'Bez fokusovatelných prvků',
  'offscreen-focus': 'Fokus mimo viewport',
};

function buildKeyboardSummaryHtml(summary) {
  const crawl = Array.isArray(summary.pages);

  if (crawl) {
    if (!Array.isArray(summary.pages) || summary.pages.length === 0) return '';

    let totalIssues = 0;
    let pagesWithIssues = 0;
    const typeCounts = {
      'focus-lost': 0,
      'focus-loop': 0,
      'no-visible-focus': 0,
      'no-focusable-elements': 0,
    };

    for (const page of summary.pages) {
      const k = page.keyboardNavigation;
      if (!k || !Array.isArray(k.issues)) continue;
      if (k.issues.length > 0) pagesWithIssues += 1;
      totalIssues += k.issues.length;
      for (const issue of k.issues) {
        if (issue && issue.type && Object.prototype.hasOwnProperty.call(typeCounts, issue.type)) {
          typeCounts[issue.type] += 1;
        }
      }
    }

    if (totalIssues === 0) return '';

    const parts = [];
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > 0) {
        const label = KEYBOARD_TYPE_LABELS[type] || type;
        parts.push(`${label}: ${count}`);
      }
    }

    return `
    <div class="summary-item">
      <div class="summary-label">Klávesnicová navigace</div>
      <div class="summary-value">${totalIssues} problémů na ${pagesWithIssues} stránkách</div>
      <div class="muted">${parts.join(' · ')}</div>
    </div>`;
  }

  const k = summary.keyboardNavigation;
  if (!k || !Array.isArray(k.issues) || k.issues.length === 0) return '';

  const typeCounts = {
    'focus-lost': 0,
    'focus-loop': 0,
    'no-visible-focus': 0,
    'no-focusable-elements': 0,
  };

  for (const issue of k.issues) {
    if (issue && issue.type && Object.prototype.hasOwnProperty.call(typeCounts, issue.type)) {
      typeCounts[issue.type] += 1;
    }
  }

  const parts = [];
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > 0) {
      const label = KEYBOARD_TYPE_LABELS[type] || type;
      parts.push(`${label}: ${count}`);
    }
  }

  return `
    <div class="summary-item">
      <div class="summary-label">Klávesnicová navigace</div>
      <div class="summary-value">${k.issues.length} problémů (Tab kroky: ${k.totalSteps ?? '-'})</div>
      <div class="muted">${parts.join(' · ')}</div>
    </div>`;
}

function collectKeyboardIssues(summary) {
  const issues = [];

  const crawl = Array.isArray(summary.pages);

  if (crawl && Array.isArray(summary.pages)) {
    for (const page of summary.pages) {
      const k = page.keyboardNavigation;
      if (!k || !Array.isArray(k.issues)) continue;
      for (const issue of k.issues) {
        issues.push({
          ...issue,
          pageUrl: page.url,
        });
      }
    }
  } else if (summary.keyboardNavigation && Array.isArray(summary.keyboardNavigation.issues)) {
    for (const issue of summary.keyboardNavigation.issues) {
      issues.push({
        ...issue,
        pageUrl: summary.url || '',
      });
    }
  }

  return issues;
}

function loadLocalTrendData(currentPath, currentSummary) {
  try {
    const dir = path.dirname(currentPath);
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^report-\d+\.json$/i.test(f));

    const currentTsMatch = path.basename(currentPath).match(/report-(\d+)\.json$/i);
    const currentTs = currentTsMatch ? Number(currentTsMatch[1]) : null;

    const summaries = [];

    const currentIsCrawl = Array.isArray(currentSummary.pages);

    for (const file of files) {
      const match = file.match(/report-(\d+)\.json$/i);
      if (!match) continue;
      const ts = Number(match[1]);
      const fullPath = path.join(dir, file);
      if (currentTs != null && ts > currentTs) continue;

      let json;
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        json = JSON.parse(raw);
      } catch {
        continue;
      }

      const isCrawlFile = Array.isArray(json.pages);
      const urlKey = isCrawlFile ? json.rootUrl : json.url;
      const currentUrlKey = currentIsCrawl ? currentSummary.rootUrl : currentSummary.url;
      if (urlKey && currentUrlKey && urlKey !== currentUrlKey) continue;

      const score = isCrawlFile
        ? (typeof json.averageScore === 'number' ? json.averageScore : null)
        : (typeof json.score === 'number' ? json.score : null);

      const totalViolations = isCrawlFile
        ? (typeof json.totalViolations === 'number' ? json.totalViolations : null)
        : (json.stats && typeof json.stats.totalViolations === 'number' ? json.stats.totalViolations : null);

      const critical = isCrawlFile
        ? (typeof json.totalCriticalViolations === 'number' ? json.totalCriticalViolations : null)
        : (json.stats && typeof json.stats.criticalCount === 'number' ? json.stats.criticalCount : null);

      summaries.push({ ts, score, totalViolations, critical });
    }

    summaries.sort((a, b) => a.ts - b.ts);
    return summaries;
  } catch {
    return [];
  }
}

function buildTrendSummaryHtml(trendSummaries) {
  if (!trendSummaries || trendSummaries.length < 2) return '';

  const latest = trendSummaries[trendSummaries.length - 1];
  const prev = trendSummaries[trendSummaries.length - 2];

  if (!latest || !prev) return '';

  const deltaScore =
    typeof latest.score === 'number' && typeof prev.score === 'number'
      ? latest.score - prev.score
      : null;

  const deltaIssues =
    typeof latest.totalViolations === 'number' && typeof prev.totalViolations === 'number'
      ? latest.totalViolations - prev.totalViolations
      : null;

  const deltaCritical =
    typeof latest.critical === 'number' && typeof prev.critical === 'number'
      ? latest.critical - prev.critical
      : null;

  let alertLabel = '';
  let alertClass = '';

  if ((deltaScore != null && deltaScore <= -5) || (deltaCritical != null && deltaCritical > 0)) {
    alertLabel = 'Upozornění: přístupnost se od posledního běhu zhoršila.';
    alertClass = 'trend-bad';
  } else if ((deltaScore != null && deltaScore >= 5) && (deltaCritical != null && deltaCritical <= 0)) {
    alertLabel = 'Dobrá zpráva: přístupnost se od posledního běhu zlepšila.';
    alertClass = 'trend-good';
  }

  const parts = [];
  if (deltaScore != null && !Number.isNaN(deltaScore)) {
    parts.push(`Skóre: ${prev.score ?? '-'} → ${latest.score ?? '-'} (${deltaScore >= 0 ? '+' : ''}${deltaScore})`);
  }
  if (deltaIssues != null && !Number.isNaN(deltaIssues)) {
    parts.push(`Chyb: ${prev.totalViolations ?? '-'} → ${latest.totalViolations ?? '-'} (${deltaIssues >= 0 ? '+' : ''}${deltaIssues})`);
  }
  if (deltaCritical != null && !Number.isNaN(deltaCritical)) {
    parts.push(`Kritických: ${prev.critical ?? '-'} → ${latest.critical ?? '-'} (${deltaCritical >= 0 ? '+' : ''}${deltaCritical})`);
  }

  const metaText = parts.join(' · ');

  return `
    <div class="summary-item trend-summary ${alertClass}">
      <div class="summary-label">Trend oproti poslednímu běhu</div>
      <div class="summary-value">${escapeHtml(metaText || 'Zatím nemáme k dispozici dost dat.')}</div>
      ${alertLabel ? `<div class="muted">${escapeHtml(alertLabel)}</div>` : ''}
    </div>`;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildIssuesCsv(rows) {
  const header = [
    'occurrences',
    'priority',
    'impact',
    'category',
    'what',
    'fix',
    'pageUrl',
    'selector',
    'elementLabel',
    'fingerprint',
    'componentName',
    'ruleId',
    'wcag',
    'actRuleIds',
    'actRuleUrls',
  ];

  const lines = [header.map(csvEscape).join(',')];

  for (const item of rows) {
    const impact = item.impact || '';
    const pageUrl = item.pageUrl || item.exampleUrl || '';
    const wcag = item.wcagReference || '';
    const actIds = Array.isArray(item.actRuleIds) ? item.actRuleIds.join('|') : '';
    const actUrls = Array.isArray(item.actRuleUrls) ? item.actRuleUrls.join('|') : '';

    const row = [
      item.occurrences || 1,
      item.priority || '',
      impact,
      item.category || '',
      item.what || '',
      item.fix || '',
      pageUrl,
      item.exampleTarget || '',
      item.elementLabel || '',
      item.fingerprint || '',
      item.componentName || '',
      item.id || '',
      wcag,
      actIds,
      actUrls,
    ];

    lines.push(row.map(csvEscape).join(','));
  }

  return lines.join('\n');
}

function collectRawActionItems(summary) {
  const items = [];

  const crawl = Array.isArray(summary.pages);

  if (crawl) {
    for (const page of summary.pages || []) {
      const hr = page.humanReadable;
      if (!hr || !Array.isArray(hr.actionItems)) continue;
      for (const it of hr.actionItems) {
        items.push({
          ...it,
          pageUrl: page.url,
        });
      }
    }
  } else {
    const hr = summary.humanReadable;
    if (hr && Array.isArray(hr.actionItems)) {
      for (const it of hr.actionItems) {
        items.push({
          ...it,
          pageUrl: summary.url,
        });
      }
    }
  }

  return items;
}

function aggregateItems(rawItems) {
  const map = new Map();

  for (const item of rawItems) {
    const pageUrl = item.pageUrl || item.exampleUrl || '';
    const ruleId = item.id || 'unknown-rule';
    const selectorKey = item.exampleTarget || '';
    const key = `${ruleId}||${pageUrl}||${selectorKey}`;

    const base = map.get(key) || {
      id: ruleId,
      impact: item.impact || null,
      priority: item.priority || '',
      category: item.category || '',
      what: item.what || '',
      fix: item.fix || '',
      wcagReference: item.wcagReference,
      pageUrl,
      exampleUrl: item.exampleUrl || pageUrl,
      exampleTarget: item.exampleTarget,
      elementLabel: item.elementLabel,
      technicalSummary: item.technicalSummary,
      actRuleIds: item.actRuleIds,
      actRuleUrls: item.actRuleUrls,
      fingerprint: item.fingerprint,
      componentName: item.componentName,
      occurrences: 0,
    };

    // Pokud přichází další záznam se stejným klíčem a má ACT metadata,
    // která jsme dosud neměli, doplníme je.
    if ((!base.actRuleIds || base.actRuleIds.length === 0) && Array.isArray(item.actRuleIds) && item.actRuleIds.length > 0) {
      base.actRuleIds = item.actRuleIds;
    }
    if ((!base.actRuleUrls || base.actRuleUrls.length === 0) && Array.isArray(item.actRuleUrls) && item.actRuleUrls.length > 0) {
      base.actRuleUrls = item.actRuleUrls;
    }

    // Element-first identita: pokud nemáme elementLabel, zkusíme ho doplnit
    // buď z aktuální položky, nebo jako jednoduchý fallback ze selectoru.
    if (!base.elementLabel) {
      if (item.elementLabel) {
        base.elementLabel = item.elementLabel;
      } else if (item.exampleTarget) {
        base.elementLabel = item.exampleTarget;
      }
    }

    // Pokud nemáme componentName a nová položka ho má, doplníme ho
    if (!base.componentName && item.componentName) {
      base.componentName = item.componentName;
    }

    base.occurrences += 1;
    map.set(key, base);
  }

  const result = Array.from(map.values());
  for (const it of result) {
    it.priorityScore = computePriorityScore(it);
  }

  result.sort((a, b) => {
    const ps = (b.priorityScore || 0) - (a.priorityScore || 0);
    if (ps !== 0) return ps;
    return (b.occurrences || 0) - (a.occurrences || 0);
  });

  return result;
}

const rawItems = collectRawActionItems(data);
const aggregatedItems = aggregateItems(rawItems);

const priorities = Array.from(
  new Set(aggregatedItems.map((i) => i.priority).filter(Boolean)),
).sort();

const categories = Array.from(
  new Set(aggregatedItems.map((i) => i.category).filter(Boolean)),
).sort();

let summaryTitle;
if (isCrawl) {
  const root = data.rootUrl || 'neznámý web';
  const pages = data.totalPagesScanned ?? (Array.isArray(data.pages) ? data.pages.length : '-');
  summaryTitle = `Shrnutí automatického auditu pro ${root} – ${pages} stránek`;
} else {
  const url = data.url || 'neznámou stránku';
  summaryTitle = `Shrnutí automatického auditu pro ${url}`;
}

const keyboardIssues = collectKeyboardIssues(data);

const outputHtml = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8" />
  <title>A11yFlow – Automated Accessibility Audit Report</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 24px; background: #f5f5f7; color: #222; }
    h1 { margin-bottom: 0.25rem; }
    .subtitle { color: #555; margin-bottom: 1.5rem; }
    .summary { background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; gap: 32px; align-items: flex-start; }
    .summary-column { display: flex; flex-wrap: wrap; gap: 16px; }
    .summary-column-left { flex: 2; }
    .summary-column-right { flex: 1; justify-content: flex-end; }
    .summary-item { margin-right: 24px; margin-bottom: 8px; }
    .summary-item.summary-status { border-right: 1px solid #eee; padding-right: 24px; margin-right: 24px; }
    .summary-label { font-size: 12px; text-transform: uppercase; color: #777; }
    .summary-value { font-size: 18px; font-weight: 600; }
    .summary-value.metric-good { color: #2e7d32; }
    .summary-value.metric-ok { color: #f9a825; }
    .summary-value.metric-bad { color: #c62828; }
    .summary-value.status-good { color: #2e7d32; }
    .summary-value.status-warn { color: #f9a825; }
    .summary-value.status-bad { color: #c62828; }
    .trend-summary.trend-good .summary-value { color: #2e7d32; }
    .trend-summary.trend-bad .summary-value { color: #c62828; }

    .filters { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; align-items: center; }
    .filters label { font-size: 13px; color: #444; }
    .filters select, .filters input[type="search"] { padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; }

    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    thead { background: #f0f0f3; }
    th, td { padding: 8px 10px; font-size: 13px; text-align: left; border-bottom: 1px solid #eee; vertical-align: top; }
    th { font-weight: 600; color: #444; white-space: nowrap; }
    tr:nth-child(even) td { background: #fafafa; }
    tr:hover td { background: #f3f7ff; }

    .priority { font-weight: 600; }
    .priority-critical { color: #d32f2f; }
    .priority-high { color: #ef6c00; }
    .priority-medium { color: #f9a825; }
    .priority-low { color: #1976d2; }

    .pill { display: inline-block; padding: 2px 6px; border-radius: 999px; background: #eef2ff; font-size: 11px; color: #3949ab; }

    .muted { color: #777; font-size: 12px; }
    a { color: #1565c0; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .quick-wins { margin: 4px 0 20px 0; }
    .quick-wins h2 { margin: 0 0 4px 0; font-size: 18px; }
    .quick-wins ul { margin: 4px 0 0 18px; padding: 0; }
    .quick-wins li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <h1>A11yFlow – Automated Accessibility Audit Report</h1>
  <div class="subtitle">${escapeHtml(summaryTitle)}</div>

  <div class="summary">
    ${Array.isArray(data.pages) ? `
    <div class="summary-column summary-column-left">
      ${buildExecutiveStatusHtml(data)}
      ${buildWcagLevelSummaryHtml(aggregatedItems)}
      ${buildActSummaryHtml(aggregatedItems)}
      <div class="summary-item">
        <div class="summary-label">Root URL</div>
        <div class="summary-value">${escapeHtml(data.rootUrl || '')}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Počet stránek</div>
        <div class="summary-value">${data.totalPagesScanned ?? '-'}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Průměrné skóre</div>
        <div class="summary-value">${data.averageScore ?? '-'} / 100</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Celkem chyb</div>
        <div class="summary-value">${data.totalViolations ?? '-'}</div>
      </div>
      ${buildTrendSummaryHtml(loadLocalTrendData(inputPath, data))}
    </div>
    <div class="summary-column summary-column-right">
      ${buildPerformanceSummaryHtml(data)}
      ${buildKeyboardSummaryHtml(data)}
    </div>
    ` : `
    <div class="summary-column summary-column-left">
      ${buildExecutiveStatusHtml(data)}
      ${buildWcagLevelSummaryHtml(aggregatedItems)}
      ${buildActSummaryHtml(aggregatedItems)}
      <div class="summary-item">
        <div class="summary-label">URL</div>
        <div class="summary-value">${escapeHtml(data.url || '')}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Skóre</div>
        <div class="summary-value">${data.score ?? '-'} / 100</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Celkem chyb</div>
        <div class="summary-value">${data.stats ? data.stats.totalViolations : '-'}</div>
      </div>
      ${buildTrendSummaryHtml(loadLocalTrendData(inputPath, data))}
    </div>
    <div class="summary-column summary-column-right">
      ${buildPerformanceSummaryHtml(data)}
      ${buildKeyboardSummaryHtml(data)}
    </div>
    `}
  </div>

  ${buildQuickWinsHtml(aggregatedItems)}

  <div class="filters">
    <label>
      Priorita:
      <select id="priorityFilter">
        <option value="">Vše</option>
        ${priorities.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
      </select>
    </label>
    <label>
      Kategorie:
      <select id="categoryFilter">
        <option value="">Vše</option>
        ${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </label>
    <label>
      Hledat:
      <input id="searchInput" type="search" placeholder="text problému / opravy / URL" />
    </label>
    <span class="muted">Unikátních problémů: ${aggregatedItems.length}</span>
  </div>

  <table id="issuesTable">
    <thead>
      <tr>
        <th>Výskytů</th>
        <th>Priorita</th>
        <th>Kategorie</th>
        <th>Co je špatně</th>
        <th>Jak opravit</th>
        <th>Stránka</th>
        <th>Element</th>
        <th>Selector</th>
        <th>Pravidlo</th>
        <th>WCAG</th>
        <th>ACT Rule</th>
      </tr>
    </thead>
    <tbody>
      ${aggregatedItems.map(item => {
        const impact = (item.impact || '').toLowerCase();
        let priorityClass = 'priority-low';
        if (impact === 'critical') priorityClass = 'priority-critical';
        else if (impact === 'serious') priorityClass = 'priority-high';
        else if (impact === 'moderate') priorityClass = 'priority-medium';

        const pageUrl = item.pageUrl || item.exampleUrl || '';
        const occurrences = item.occurrences || 1;
        const wcag = item.wcagReference || '';
        const wcagCell = wcag ? buildWcagLink(wcag) : '';
        const technical = item.technicalSummary || '';
        const actCell = buildActRuleCell(item);
        const elementLabel = item.elementLabel || '';
        const selector = item.exampleTarget || '';

        return `<tr data-priority="${escapeHtml(item.priority || '')}" data-category="${escapeHtml(item.category || '')}">
          <td>${occurrences}</td>
          <td class="priority ${priorityClass}">${escapeHtml(item.priority || '')}</td>
          <td><span class="pill">${escapeHtml(item.category || '')}</span></td>
          <td>${escapeHtml(item.what || '')}${technical ? `<div class="muted">${escapeHtml(technical)}</div>` : ''}</td>
          <td>${escapeHtml(item.fix || '')}</td>
          <td>${pageUrl ? `<a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pageUrl)}</a>` : ''}</td>
          <td>${escapeHtml(elementLabel)}</td>
          <td>${escapeHtml(selector)}</td>
          <td class="muted">${escapeHtml(item.id || '')}</td>
          <td class="muted">${wcagCell}</td>
          <td class="muted">${actCell}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  ${keyboardIssues.length > 0 ? `
  <h2 style="margin-top:32px; margin-bottom:8px;">Klávesnicová navigace – detailní analýza</h2>
  <p class="muted" style="margin-bottom:12px;">Každý řádek představuje konkrétní problém zjištěný při průchodu stránky klávesou Tab.</p>
  <table id="keyboardTable">
    <thead>
      <tr>
        <th>Stránka</th>
        <th>Typ problému</th>
        <th>Proč je to problém</th>
        <th>Selector</th>
        <th>WCAG</th>
      </tr>
    </thead>
    <tbody>
      ${keyboardIssues.map(issue => {
        const label = KEYBOARD_TYPE_LABELS[issue.type] || issue.type;
        const url = issue.pageUrl || '';
        const wcagCell = issue.wcagReference ? buildWcagLink(issue.wcagReference) : '-';
        return `<tr>
          <td>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>` : ''}</td>
          <td>${escapeHtml(label)}</td>
          <td>${escapeHtml(issue.description || '')}</td>
          <td>${escapeHtml(issue.selector || '')}</td>
          <td>${wcagCell}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  <script>
    function applyFilters() {
      var pri = document.getElementById('priorityFilter').value;
      var cat = document.getElementById('categoryFilter').value;
      var search = document.getElementById('searchInput').value.toLowerCase();

      var rows = document.querySelectorAll('#issuesTable tbody tr');
      rows.forEach(function(row) {
        var matchesPri = !pri || row.getAttribute('data-priority') === pri;
        var matchesCat = !cat || row.getAttribute('data-category') === cat;
        var text = row.textContent.toLowerCase();
        var matchesSearch = !search || text.indexOf(search) !== -1;

        row.style.display = (matchesPri && matchesCat && matchesSearch) ? '' : 'none';
      });
    }

    document.getElementById('priorityFilter').addEventListener('change', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);
  </script>
</body>
</html>`;

const outputPath = inputPath.replace(/\.json$/i, '.html');
fs.writeFileSync(outputPath, outputHtml, 'utf8');
console.log('HTML report generated at:', outputPath);

const csvPath = inputPath.replace(/\.json$/i, '-issues.csv');
const csvContent = buildIssuesCsv(aggregatedItems);
fs.writeFileSync(csvPath, csvContent, 'utf8');
console.log('CSV export generated at:', csvPath);
