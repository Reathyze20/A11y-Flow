import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import {
  AuditReport,
  AccessibilityViolation,
  BrokenLinksSummary,
  PerformanceReport,
  KeyboardNavigationReport,
} from './types';
import { ViolationMapper } from './ViolationMapper';
import { ScreenshotCapturer } from './ScreenshotCapturer';
import { URL } from 'url';

import { AxePuppeteer } from '@axe-core/puppeteer';
import { runCustomActSuite } from './acts/CustomActSuite';

export type ScanDevice =
  | 'desktop'
  | 'mobile'
  | 'low-vision'
  | 'reduced-motion'
  | 'tablet';

export interface ScanOptions {
  device?: ScanDevice;
}

export class WebScanner {
  private browser: Browser | null = null;
  private screenshotCapturer: ScreenshotCapturer;
  private currentPage: Page | null = null; 

  constructor() {
    this.screenshotCapturer = new ScreenshotCapturer();
  }

  public async scan(url: string, options: ScanOptions = {}): Promise<AuditReport> {
    console.log(`[WebScanner] Starting scan for: ${url}`);

    if (this.isIgnoredExtension(url)) {
      console.warn(`[WebScanner] Skipping non-HTML resource: ${url}`);
      throw new Error(`Skipping non-HTML resource: ${url}`);
    }

    try {
      const page = await this.preparePage(options);

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.handleCookieConsent(page);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const performanceReport = await this.collectPerformanceReportSafe(page);
      await this.exploreDynamicStatesSafe(page);
      const keyboardReport = await this.runKeyboardAuditSafe(page);

      const report = await this.runAxeAndMap(url, page);
      await this.runCustomActSuiteSafe(page, url, report);

      if (performanceReport) {
        report.performance = performanceReport;
      }

      if (keyboardReport) {
        report.keyboardNavigation = keyboardReport;
      }

      report.brokenLinks = await this.checkBrokenLinksSafe(page);

      const violationsToCapture = [
        ...report.violations.critical,
        ...report.violations.serious,
        ...report.violations.moderate,
        ...report.violations.minor,
      ];

      await this.enrichViolationsWithScreenshots(page, violationsToCapture);

      return report;
    } catch (error) {
      console.error(`Scanner Error processing ${url}:`, error);
      throw error;
    }
  }

  private async handleCookieConsent(page: Page): Promise<void> {
    console.log('[WebScanner] Checking for cookie banners...');

    const commonSelectors = [
      '#onetrust-accept-btn-handler',
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '.cc-btn.cc-allow',
      '[data-testid="cookie-policy-dialog-accept-button"]',
      'button[id*="cookie"][id*="accept"]',
      'button[class*="cookie"][class*="accept"]',
    ];

    try {
      for (const selector of commonSelectors) {
        if (await page.$(selector)) {
          console.log(`[WebScanner] Dismissing cookies via selector: ${selector}`);
          await page.click(selector);
          return;
        }
      }

      const keywords = [
        'Souhlasím',
        'Povolit vše',
        'Přijmout',
        'Accept',
        'Allow all',
        'Agree',
        'Rozumím',
        'I understand',
      ];

      const xpathConditions = keywords
        .map(
          (k) =>
            `contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${k.toLowerCase()}')`,
        )
        .join(' or ');

      const xpath = `//button[${xpathConditions}]`;

      const buttons = await (page as any).$x(xpath);

      if (buttons.length > 0) {
        console.log(`[WebScanner] Dismissing cookies via text match (${buttons.length} candidates)`);
        await (buttons[0] as any).click();
      } else {
        console.log('[WebScanner] No cookie banner found (or scan continued without dismissal).');
      }
    } catch (e) {
      console.warn('[WebScanner] Non-fatal error closing cookies:', e);
    }
  }

  public async extractInternalLinks(rootHostname: string): Promise<string[]> {
    if (!this.currentPage) return [];

    try {
      // 1. Pokusíme se "probudit" megamenu – tentokrát hoverujeme
      // nejen <li>, ale i samotné odkazy, protože často je
      // posluchač události navěšený právě na <a>.
      try {
        const hoverSelectors = [
          'nav li, header li, .menu-item, [role="navigation"] li',
          'nav a, header a, .menu-item > a, [role="navigation"] a'
        ];

        for (const selector of hoverSelectors) {
          const elements = await this.currentPage.$$(selector);
          const itemsToHover = elements.slice(0, 30); // trochu větší limit, ale pořád bezpečný

          console.log(`[WebScanner] Expanding menus via selector "${selector}" (items=${itemsToHover.length})`);

          for (const el of itemsToHover) {
            try {
              await el.hover();
              // krátká pauza, aby se stihl vykreslit dropdown / megamenu
              await new Promise(r => setTimeout(r, 120));
            } catch {
              // pokud hover selže (element zmizel apod.), prostě pokračujeme
            }
          }
        }
      } catch (e) {
        console.warn('[WebScanner] Menu expansion failed, continuing with static links.', e);
      }

      // 2. Extrakce odkazů (nyní by měly být v DOMu i ty z submenu)
      const links = await this.currentPage.$$eval('a', (anchors) => 
        anchors.map(a => a.href)
      );

      const uniqueLinks = new Set<string>();
      
      for (const link of links) {
        try {
          if (this.isIgnoredExtension(link)) continue;

          const urlObj = new URL(link);
          if (urlObj.hostname === rootHostname && !link.includes('#')) {
            uniqueLinks.add(link);
          }
        } catch (e) {
        }
      }
      
      console.log(`[WebScanner] Extracted ${uniqueLinks.size} internal links.`);
      return Array.from(uniqueLinks);

    } catch (e) {
      console.warn('Link extraction failed:', e);
      return [];
    }
  }

  private isIgnoredExtension(url: string): boolean {
    const ignoredExtensions = [
      '.xml', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.json', '.zip'
    ];
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        return ignoredExtensions.some(ext => pathname.endsWith(ext));
    } catch {
        return false;
    }
  }

  private async configureDeviceProfile(page: Page, device: ScanDevice): Promise<void> {
    if (device === 'mobile') {
      console.log('[WebScanner] Using MOBILE emulation (iPhone-like viewport).');
      await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      );
      await page.setViewport({
        width: 390,
        height: 844,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });
    } else if (device === 'tablet') {
      console.log('[WebScanner] Using TABLET viewport (iPad-like).');
      await page.setUserAgent(
        'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      );
      await page.setViewport({ width: 1024, height: 768, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    } else {
      console.log('[WebScanner] Using DESKTOP viewport.');
      await page.setUserAgent('A11yFlow-Bot/1.0 (+https://a11yflow.com)');
      await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    }

    if (device === 'low-vision') {
      console.log('[WebScanner] Applying LOW-VISION profile (zoom + bigger text).');
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false });
      await page.addStyleTag({
        content:
          'html { font-size: 120% !important; } body { line-height: 1.6 !important; }',
      });
    }

    if (device === 'reduced-motion') {
      console.log('[WebScanner] Applying REDUCED-MOTION media preference.');
      try {
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ] as any);
      } catch (e) {
        console.warn('[WebScanner] emulateMediaFeatures for reduced-motion failed:', e);
      }
    }
  }

  private async checkBrokenLinks(page: Page): Promise<BrokenLinksSummary> {
    const pageUrl = page.url();
    let host: string | null = null;
    try {
      host = new URL(pageUrl).hostname;
    } catch {
      host = null;
    }

    const hrefs: string[] = await page.$$eval('a', anchors => anchors.map(a => (a as any).href));

    const unique = Array.from(new Set(hrefs)).filter(Boolean);

    // Filtrujeme na stejné hostname a HTTP/HTTPS protokol
    const candidates = unique.filter(link => {
      try {
        const u = new URL(link);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
        if (host && u.hostname !== host) return false;
        return true;
      } catch {
        return false;
      }
    }).slice(0, 40); // bezpečnostní limit na stránku

    console.log(`[WebScanner] Checking ${candidates.length} internal links for 4xx/5xx status codes...`);

    async function headWithTimeout(targetUrl: string, timeoutMs: number): Promise<{ status: number | null; ok: boolean }> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(targetUrl, { method: 'HEAD', signal: controller.signal as any });
        clearTimeout(timeout);
        const ok = res.status >= 200 && res.status < 400;
        return { status: res.status, ok };
      } catch {
        clearTimeout(timeout);
        return { status: null, ok: false };
      }
    }

    const broken: { url: string; status: number | null; ok: boolean }[] = [];

    await Promise.all(
      candidates.map(async (link) => {
        const { status, ok } = await headWithTimeout(link, 5000);
        if (!ok) {
          broken.push({ url: link, status, ok });
        }
      })
    );

    console.log(`[WebScanner] Broken links on page: ${broken.length}`);

    return {
      totalChecked: candidates.length,
      broken,
    };
  }

  private async preparePage(options: ScanOptions): Promise<Page> {
    if (!this.browser) {
      await this.initBrowser();
    }

    if (!this.browser) {
      throw new Error('Browser failed to initialize');
    }

    if (this.currentPage) {
      await this.currentPage.close().catch(() => {});
    }

    this.currentPage = await this.browser.newPage();
    const page = this.currentPage;

    const device: ScanDevice = (options.device as ScanDevice) || 'desktop';

    await this.configureDeviceProfile(page, device);
    await this.setupPerformanceObservers(page);

    return page;
  }

  private async collectPerformanceReportSafe(page: Page): Promise<PerformanceReport | undefined> {
    try {
      return await this.collectPerformanceMetrics(page);
    } catch (error) {
      console.warn('[WebScanner] Failed to collect performance metrics:', error);
      return undefined;
    }
  }

  private async exploreDynamicStatesSafe(page: Page): Promise<void> {
    try {
      await this.exploreDynamicStates(page);
    } catch (error) {
      console.warn('[WebScanner] Dynamic state exploration failed (non-fatal):', error);
    }
  }

  private async runKeyboardAuditSafe(page: Page): Promise<KeyboardNavigationReport | undefined> {
    try {
      return await this.runKeyboardNavigationAudit(page);
    } catch (error) {
      console.warn('[WebScanner] Keyboard navigation audit failed (non-fatal):', error);
      return undefined;
    }
  }

  private async runAxeAndMap(url: string, page: Page): Promise<AuditReport> {
    console.log(`[WebScanner] Running Axe analysis on ${url}...`);

    const results = await new AxePuppeteer(page)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
      .analyze();

    console.log(`[WebScanner] Analysis complete. Violations found: ${results.violations.length}`);

    return ViolationMapper.mapToReport(url, results);
  }

  private async runCustomActSuiteSafe(
    page: Page,
    url: string,
    report: AuditReport,
  ): Promise<void> {
    try {
      const customAct = await runCustomActSuite(page, url);

      for (const violation of customAct.violations) {
        const impact = violation.impact || 'moderate';

        if (impact === 'critical') {
          report.violations.critical.push(violation);
        } else if (impact === 'serious') {
          report.violations.serious.push(violation);
        } else if (impact === 'minor') {
          report.violations.minor.push(violation);
        } else {
          report.violations.moderate.push(violation);
        }

        report.stats.totalViolations += violation.count;
        if (impact === 'critical') {
          report.stats.criticalCount += violation.count;
        }
      }

      if (customAct.actionItems.length > 0) {
        report.humanReadable.actionItems.push(...customAct.actionItems);
      }
    } catch (error) {
      console.warn('[WebScanner] Custom ACT suite failed (non-fatal):', error);
    }
  }

  private async checkBrokenLinksSafe(page: Page): Promise<BrokenLinksSummary | undefined> {
    try {
      return await this.checkBrokenLinks(page);
    } catch (error) {
      console.warn('[WebScanner] Broken links check failed, continuing without it.', error);
      return undefined;
    }
  }

  public async closeBrowser() {
    if (this.currentPage) await this.currentPage.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.currentPage = null;
  }

  private async enrichViolationsWithScreenshots(page: Page, violations: AccessibilityViolation[]) {
    if (!process.env.A11Y_SCREENSHOT_BUCKET) return;

    for (const violation of violations) {
      const nodesToCapture = violation.nodes.slice(0, 1);
      for (const node of nodesToCapture) {
        const url = await this.screenshotCapturer.captureAndUpload(page, node);
        if (url) node.screenshotUrl = url;
      }
    }
  }

  private async setupPerformanceObservers(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      const w = globalThis as any;
      w.__a11yflowMetrics = {
        lcp: null,
        cls: 0,
        inp: null,
        tbt: 0,
      };

      try {
        const poLcp = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const last: any = entries[entries.length - 1];
          if (last) {
            w.__a11yflowMetrics.lcp =
              (last as any).renderTime || (last as any).loadTime || last.startTime || null;
          }
        });
        poLcp.observe({ type: 'largest-contentful-paint', buffered: true } as any);
      } catch (e) {
        console.warn('[Perf] LCP observer not available:', e);
      }

      try {
        const poCls = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries() as any) {
            if (!entry.hadRecentInput) {
              w.__a11yflowMetrics.cls += entry.value || 0;
            }
          }
        });
        poCls.observe({ type: 'layout-shift', buffered: true } as any);
      } catch (e) {
        console.warn('[Perf] CLS observer not available:', e);
      }

      try {
        const poInp = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries() as any) {
            w.__a11yflowMetrics.inp = entry.duration || null;
          }
        });
        // Typ "event" je pro INP v moderních prohlížečích; fallback je benigní
        poInp.observe({ type: 'event', buffered: true } as any);
      } catch (e) {
        console.warn('[Perf] INP observer not available:', e);
      }

      try {
        const poLong = new PerformanceObserver((entryList) => {
          const nav = performance.getEntriesByType('navigation' as any)[0] as any;
          const fcp = performance.getEntriesByName('first-contentful-paint')[0] as any;
          const fcpTime = (fcp && fcp.startTime) || (nav && nav.responseStart) || 0;

          for (const entry of entryList.getEntries() as any) {
            const blockingTime = entry.duration - 50;
            if (blockingTime > 0 && entry.startTime > fcpTime) {
              w.__a11yflowMetrics.tbt += blockingTime;
            }
          }
        });
        poLong.observe({ type: 'longtask', buffered: true } as any);
      } catch (e) {
        console.warn('[Perf] Longtask observer (TBT) not available:', e);
      }
    });
  }

  private async collectPerformanceMetrics(page: Page): Promise<PerformanceReport | undefined> {
    try {
      const metrics = await page.evaluate(() => {
        const navEntries = performance.getEntriesByType('navigation' as any) as any[];
        const nav = navEntries && navEntries[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0] as any;
        const store = (globalThis as any).__a11yflowMetrics || {};

        return {
          coreWebVitals: {
            lcp: typeof store.lcp === 'number' ? store.lcp : null,
            cls: typeof store.cls === 'number' ? store.cls : null,
            inp: typeof store.inp === 'number' ? store.inp : null,
            tbt: typeof store.tbt === 'number' ? store.tbt : null,
          },
          navigation: {
            firstContentfulPaint: fcp ? fcp.startTime : null,
            timeToFirstByte: nav ? nav.responseStart : null,
            domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
            loadEvent: nav ? nav.loadEventEnd : null,
          },
        };
      });

      return metrics as PerformanceReport;
    } catch (e) {
      console.warn('[WebScanner] collectPerformanceMetrics failed:', e);
      return undefined;
    }
  }

  private async exploreDynamicStates(page: Page): Promise<void> {
    const clickSelectors = [
      // Typická menu / hamburger tlačítka
      'button[aria-expanded="false"][aria-controls]',
      'button[aria-haspopup="true"]',
      'button[aria-label*="menu" i]',
      'button[data-testid*="menu" i]',
      '[role="button"][data-testid*="menu" i]',
      // Časté selektory pro dialogy / modaly
      'button[data-open-modal]',
      '[data-testid*="modal-open" i]',
      'button[aria-haspopup="dialog"]',
    ];

    for (const selector of clickSelectors) {
      const handle = await page.$(selector);
      if (handle) {
        console.log(`[WebScanner] Clicking dynamic element: ${selector}`);
        try {
          await handle.click();
          await new Promise((r) => setTimeout(r, 400));
        } catch {
          // best effort
        }
      }
    }

    // Jednoduchý pokus o přepínač jazyka (např. EN/CZ tlačítka)
    const langButtons = await page.$$('[data-testid*="language" i], button[lang], a[lang]');
    if (langButtons.length > 0) {
      console.log('[WebScanner] Toggling language switch (best-effort).');
      try {
        await langButtons[0].click();
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        // ignore
      }
    }
  }

  private async runKeyboardNavigationAudit(page: Page): Promise<KeyboardNavigationReport> {
    const maxSteps = 60;
    const issues: KeyboardNavigationReport['issues'] = [];
    const visitedSelectors = new Map<string, number>();

    // Zjistíme, jestli má stránka vůbec fokusovatelné prvky
    const hasFocusable = await page.evaluate(() => {
      const d = (globalThis as any).document as any;
      const nodeList = d.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]'
      );
      const focusables = Array.from(nodeList as any as unknown[]).filter((el: any) =>
        !el.hasAttribute('disabled') && el.tabIndex >= 0,
      );
      return focusables.length > 0;
    });

    if (!hasFocusable) {
      issues.push({
        type: 'no-focusable-elements',
        step: 0,
        description:
          'Na stránce nebyly nalezeny žádné fokusovatelné prvky (odkazy, tlačítka, formuláře). Uživatelé klávesnice a nevidomí zákazníci se čtečkami obrazovky tak nemohou stránku vůbec používat.',
        wcagReference: '2.1.1 Keyboard',
        recommendation:
          'Ujisti se, že všechny interaktivní prvky (např. odkazy, tlačítka, ovládací prvky) jsou dostupné z klávesnice – typicky pomocí nativních HTML prvků nebo správně nastaveného tabindexu. Jinak nevidomí uživatelé se čtečkou obrazovky nemají šanci ovládat obsah.',
      });

      return {
        totalSteps: 0,
        issues,
      };
    }

    // Začneme z horní části dokumentu
    await page.evaluate(() => {
      const w = globalThis as any;
      const d = w.document as any;
      if (w && typeof w.focus === 'function') {
        w.focus();
      }
      if (d && d.body && typeof d.body.focus === 'function') {
        d.body.focus();
      }
    });

    for (let step = 1; step <= maxSteps; step++) {
      await page.keyboard.press('Tab');
      await new Promise((r) => setTimeout(r, 40));

      const info = await page.evaluate(() => {
        const d = (globalThis as any).document as any;
        const active = (d && d.activeElement) || null;
        if (!active) {
          return { hasActive: false };
        }

        const rect = active.getBoundingClientRect();
        const styles = (globalThis as any).getComputedStyle(active);

        const hasVisibleFocus =
          styles.outlineStyle !== 'none' &&
          styles.outlineWidth !== '0px' &&
          styles.outlineColor !== 'rgba(0, 0, 0, 0)';

        const selectorPieces: string[] = [];
        if (active.id) selectorPieces.push(`#${active.id}`);
        if (active.className && typeof active.className === 'string') {
          const cls = active.className
            .split(/\s+/)
            .filter(Boolean)
            .map((c: string) => `.${c}`)
            .join('');
          if (cls) selectorPieces.push(cls);
        }

        const selector =
          selectorPieces.length > 0
            ? `${active.tagName.toLowerCase()}${selectorPieces.join('')}`
            : active.tagName.toLowerCase();

        const vw = (globalThis as any).innerWidth || 0;
        const vh = (globalThis as any).innerHeight || 0;
        const offscreen =
          rect.bottom <= 0 ||
          rect.top >= vh ||
          rect.right <= 0 ||
          rect.left >= vw;

        let htmlSnippet = '';
        try {
          const outer = (active as any).outerHTML || '';
          htmlSnippet = outer.length > 400 ? outer.slice(0, 400) + '…' : outer;
        } catch {
          htmlSnippet = '';
        }

        return {
          hasActive: true,
          selector,
          hasVisibleFocus,
          rect: { width: rect.width, height: rect.height },
          offscreen,
          htmlSnippet,
        };
      });

      if (!info.hasActive) {
        issues.push({
          type: 'focus-lost',
          step,
          description:
            'Po několika stiscích Tab se focus ztratil – žádný element není aktivní. Uživatel klávesnice i nevidomý zákazník se čtečkou obrazovky ztrácí kontext a může se ocitnout v pasti, odkud se nedokáže vrátit zpět do obsahu.',
          wcagReference: '2.1.2 No Keyboard Trap',
          recommendation:
            'Zajisti, aby focus vždy zůstal v rámci dokumentu nebo se vrátil na logický prvek (např. body). Vyhni se skrývání aktivního elementu bez přesunutí focusu jinam – jinak nevidomý uživatel neví, kde se nachází.',
        });
        break;
      }

      const selector = info.selector || 'unknown';

      // Fokus na prvku, který je mimo viewport nebo má nulovou velikost
      if (
        info.rect &&
        (info.rect.width <= 0 ||
          info.rect.height <= 0 ||
          (info as any).offscreen === true)
      ) {
        issues.push({
          type: 'offscreen-focus',
          step,
          selector,
          description:
            'Fokus je na prvku, který není viditelný (mimo viewport nebo s nulovou velikostí). Uživatel klávesnice ani nevidomý zákazník se čtečkou obrazovky tak netuší, kde se na stránce nachází.',
          wcagReference: '2.4.7 Focus Visible',
          recommendation:
            'Ujisti se, že fokusované prvky jsou viditelné v zorném poli (např. pomocí scrollIntoView) a nemají nulovou výšku/šířku. Nevidomí uživatelé potřebují, aby čtečka obrazovky jednoznačně oznamovala, na jakém prvku se nachází.',
          htmlSnippet: (info as any).htmlSnippet,
        });
      }

      if (!info.hasVisibleFocus) {
        issues.push({
          type: 'no-visible-focus',
          step,
          selector,
          description:
            'Fokusovaný prvek nemá zřetelný focus styl (outline). Uživatel klávesnice nevidí, kde se právě nachází, a nevidomý zákazník se čtečkou obrazovky může mít problém pochopit, co je aktuálně aktivní.',
          wcagReference: '2.4.7 Focus Visible',
          recommendation:
            'Přidej pro fokusovaný stav (např. :focus-visible) jasně viditelný styl – typicky outline s dostatečným kontrastem vůči pozadí. Pomůže to jak uživatelům klávesnice, tak nevidomým zákazníkům sledujícím obsah s asistivní technologií.',
          htmlSnippet: (info as any).htmlSnippet,
        });
      }

      if (visitedSelectors.has(selector)) {
        const firstStep = visitedSelectors.get(selector)!;
        if (step - firstStep < 10) {
          issues.push({
            type: 'focus-loop',
            step,
            selector,
            description:
              'Zdá se, že se fokus rychle cyklí mezi několika prvky. To může znamenat klávesnicovou past, ze které se uživatel klávesnice i nevidomý zákazník se čtečkou obrazovky obtížně dostává.',
            wcagReference: '2.1.2 No Keyboard Trap',
            recommendation:
              'Zkontroluj pořadí focusu (tabindex, pořadí prvků v DOMu) a zajisti, aby se fokus nezacyklil mezi malou skupinou prvků. V případě modálních oken umožni návrat zpět na předchozí prvek, aby se nevidomí uživatelé neocitli v pasti.',
            htmlSnippet: (info as any).htmlSnippet,
          });
          break;
        }
      } else {
        visitedSelectors.set(selector, step);
      }
    }

    return {
      totalSteps: Math.min(maxSteps, issues.length > 0 ? maxSteps : maxSteps),
      issues,
    };
  }

  private async initBrowser(): Promise<void> {
    const isLambda = process.env.AWS_LAMBDA_FUNCTION_VERSION !== undefined;
    
    let executablePath: string | undefined;

    if (isLambda) {
      console.log('[WebScanner] Resolving Chromium path...');
      try {
        executablePath = await chromium.executablePath();
        console.log(`[WebScanner] Chromium path resolved: ${executablePath}`);
        
        if (!executablePath) {
             throw new Error('Chromium executablePath is undefined');
        }
      } catch (e) {
        console.error('[WebScanner] Failed to resolve Chromium path:', e);
        throw e;
      }
    }

    const launchOptions = isLambda
      ? {
          args: [...chromium.args, '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox', '--single-process'],
          defaultViewport: chromium.defaultViewport,
          executablePath: executablePath,
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        }
      : {
          channel: 'chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

    console.log('[WebScanner] Launching Puppeteer...');
    this.browser = await puppeteer.launch(launchOptions as any);
    console.log('[WebScanner] Browser launched successfully.');
  }
}