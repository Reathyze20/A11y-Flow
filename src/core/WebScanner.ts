import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import {
  AuditReport,
  AccessibilityViolation,
  BrokenLinksSummary,
  PerformanceReport,
  KeyboardNavigationReport,
  HeadingStructure,
  HeadingInfo,
} from './types';
import { ViolationMapper } from './ViolationMapper';
import { ScreenshotCapturer } from './ScreenshotCapturer';
import { ScreenshotAnnotator } from './ScreenshotAnnotator';
import { BadgeService } from './BadgeService';
import { AccessibilityStatementGenerator } from './AccessibilityStatementGenerator';
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
  // Pro crawler můžeme vypnout screenshoty (uloží stovky MB)
  skipScreenshots?: boolean;
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

      report.headingStructure = await this.extractHeadingStructure(page);
      report.brokenLinks = await this.checkBrokenLinksSafe(page);

      const violationsToCapture = [
        ...report.violations.critical,
        ...report.violations.serious,
        ...report.violations.moderate,
        ...report.violations.minor,
      ];

      // Capture bounding boxes for screenshot annotation
      await this.captureBoundingBoxes(page, violationsToCapture);

      // DISABLED: Screenshot annotation nefunguje správně (Jimp color conversion issue)
      // Bez anotace je screenshot k ničemu - element selector + HTML střídají
      // if (!options.skipScreenshots) {
      //   await this.generateAnnotatedScreenshot(page, report);
      // }
      console.log('[WebScanner] Screenshot generation disabled (not needed with CSS selectors).');

      // Generate domain hash for badge
      const badgeService = new BadgeService();
      report.domainHash = badgeService.generateDomainHash(url);

      // Generate accessibility statement
      const statementGenerator = new AccessibilityStatementGenerator();
      const statement = statementGenerator.generate(report, 'cs'); // Default to Czech
      report.accessibilityStatement = statement.markdown;
      report.accessibilityStatementHtml = statement.html;

      // await this.enrichViolationsWithScreenshots(page, violationsToCapture);

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

      // Puppeteer removed page.$x, use 'xpath/' selector prefix
      const buttons = await page.$$(`xpath/${xpath}`);

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

    // Hide scrollbars to ensure consistent layout width between scan (with scrollbar) and screenshot (fullPage, no scrollbar)
    try {
        await page.addStyleTag({ content: '::-webkit-scrollbar { display: none; }' });
    } catch (e) {
        console.warn('[WebScanner] Failed to hide scrollbars:', e);
    }

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
      
      if (customAct.pageDimensions) {
        report.pageDimensions = customAct.pageDimensions;
      }

      // Capture full page screenshot for visualization (Phase 5)
      // DISABLED by user request: "Stále je přítomen screen. Odeber tuto funkcionalitu."
      /*
      try {
        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          type: 'jpeg',
          quality: 50,
          encoding: 'base64'
        });
        report.fullPageScreenshot = `data:image/jpeg;base64,${screenshotBuffer}`;
      } catch (err) {
        console.warn('[WebScanner] Failed to capture full page screenshot:', err);
      }
      */

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

    let safeCycleLength = -1;

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

        const getUniqueSelector = (el: any) => {
          if (!el || el.nodeType !== 1) return '';
          if (el.id) return '#' + el.id;
          
          const path: string[] = [];
          let current = el;
          
          while (current && current.nodeType === 1) {
              let selector = current.tagName.toLowerCase();
              if (current.id) {
                  selector = '#' + current.id;
                  path.unshift(selector);
                  break; 
              } else {
                  let sibling = current;
                  let nth = 1;
                  while (sibling = sibling.previousElementSibling) {
                      if (sibling.tagName === current.tagName) nth++;
                  }
                  if (nth > 1) selector += `:nth-of-type(${nth})`;
              }
              path.unshift(selector);
              current = current.parentNode;
          }
          return path.join(' > ');
        };

        const selector = getUniqueSelector(active);

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
        const diff = step - firstStep;

        // Pokud se vrátíme na začátek (step 1), považujeme délku tohoto cyklu za "bezpečnou" (page wrap)
        if (firstStep === 1) {
          safeCycleLength = diff;
        }

        // Reportujeme jen pokud je smyčka krátká (< 10) A NENÍ to jen opakování celého cyklu stránky
        if (diff < 10 && diff !== safeCycleLength) {
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

    let localExecutablePath = '';
    if (!isLambda) {
      try {
        // Try to get the path from the full puppeteer package
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const p = require('puppeteer');
        localExecutablePath = p.executablePath();
      } catch (e) {
        console.warn('[WebScanner] Could not load puppeteer executable path, relying on system chrome');
      }
    }

    const launchOptions = isLambda
      ? {
          args: [...(chromium as any).args, '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox', '--single-process', '--autoplay-policy=no-user-gesture-required'],
          defaultViewport: (chromium as any).defaultViewport,
          executablePath: executablePath,
          headless: (chromium as any).headless,
          ignoreHTTPSErrors: true,
        }
      : {
          executablePath: localExecutablePath || undefined,
          channel: localExecutablePath ? undefined : 'chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
        };

    console.log('[WebScanner] Launching Puppeteer...');
    this.browser = await puppeteer.launch(launchOptions as any);
    console.log('[WebScanner] Browser launched successfully.');
  }

  /**
   * Capture bounding boxes for all violation nodes
   * Používá se pro screenshot annotation feature
   */
  private async captureBoundingBoxes(
    page: Page,
    violations: AccessibilityViolation[]
  ): Promise<void> {
    console.log('[WebScanner] Capturing bounding boxes for violations...');

    for (const violation of violations) {
      for (const node of violation.nodes) {
        try {
          // Zkusit najít element pomocí target selektoru
          if (node.target && node.target.length > 0) {
            const selector = Array.isArray(node.target) ? node.target[0] : node.target;
            
            // Puppeteer může mít problém s některými axe selektory,
            // takže musíme použít evaluate pro nalezení elementu
            const boundingBox = await page.evaluate((sel) => {
              try {
                // Zkusit jako CSS selector
                const element = document.querySelector(sel);
                if (element) {
                  const rect = element.getBoundingClientRect();
                  return {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                  };
                }
                return null;
              } catch (e) {
                return null;
              }
            }, selector);

            if (boundingBox) {
              node.boundingBox = boundingBox;
            }
          }
        } catch (error) {
          // Ignorovat chyby při zachycování bounding boxů
          console.warn(`[WebScanner] Failed to capture bounding box for ${node.target}:`, error);
        }
      }
    }

    const capturedCount = violations.reduce(
      (sum, v) => sum + v.nodes.filter(n => n.boundingBox).length,
      0
    );
    console.log(`[WebScanner] Captured ${capturedCount} bounding boxes.`);
  }

  /**
   * Generate annotated screenshot with violation markers
   */
  private async generateAnnotatedScreenshot(
    page: Page,
    report: AuditReport
  ): Promise<void> {
    try {
      console.log('[WebScanner] Generating annotated screenshot...');

      // Pokud nejsou žádné critical nebo serious violations, nemusíme anotovat
      const hasCriticalOrSerious = 
        report.violations.critical.length > 0 || 
        report.violations.serious.length > 0;

      if (!hasCriticalOrSerious) {
        console.log('[WebScanner] No critical/serious violations, skipping annotation.');
        return;
      }

      // Získat celkovou výšku stránky
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      
      // Pokud je stránka příliš dlouhá, omezíme screenshot (hnání počáteční viewport + 2000px)
      const MAX_SCREENSHOT_HEIGHT = 2500;
      const shouldLimitHeight = pageHeight > MAX_SCREENSHOT_HEIGHT;
      
      if (shouldLimitHeight) {
        console.log(`[WebScanner] Page too tall (${pageHeight}px), limiting screenshot to ${MAX_SCREENSHOT_HEIGHT}px`);
      }

      // Capture screenshot s omezením
      const screenshotOptions: any = {
        type: 'jpeg',
        quality: 50, // Sníženo z 70 na 50 pro menší velikost
        encoding: 'base64'
      };

      if (shouldLimitHeight) {
        // Nativní clip pro omezení výšky
        const viewport = page.viewport();
        screenshotOptions.clip = {
          x: 0,
          y: 0,
          width: viewport?.width || 1280,
          height: Math.min(pageHeight, MAX_SCREENSHOT_HEIGHT)
        };
        screenshotOptions.fullPage = false;
      } else {
        screenshotOptions.fullPage = true;
      }

      const screenshotBuffer = await page.screenshot(screenshotOptions) as string;

      // Annotate screenshot
      const annotator = new ScreenshotAnnotator();
      const annotatedBase64 = await annotator.annotateScreenshot(
        screenshotBuffer,
        report.violations,
        ['critical', 'serious'] // Pouze critical a serious
      );

      // Uložit do reportu
      report.annotatedScreenshot = annotatedBase64;
      
      console.log(`[WebScanner] Annotated screenshot generated (${Math.round(annotatedBase64.length / 1024)}KB).`);
    } catch (error) {
      console.warn('[WebScanner] Failed to generate annotated screenshot:', error);
      // Non-fatal, pokračujeme bez annotated screenshot
    }
  }
  /**
   * Extract heading structure (h1-h6) from the page
   */
  private async extractHeadingStructure(page: Page): Promise<HeadingStructure> {
    try {
      console.log('[WebScanner] Extracting heading structure...');

      const headings = await page.evaluate(() => {
        const result: Array<{ level: number; text: string; selector?: string }> = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach((el, index) => {
          const tagName = el.tagName.toLowerCase();
          const level = parseInt(tagName.substring(1));
          const text = el.textContent?.trim() || '';
          
          const id = el.id ? `#${el.id}` : '';
          const className = el.className ? `.${el.className.split(' ')[0]}` : '';
          const selector = id || `${tagName}${className}`;
          
          result.push({
            level,
            text,
            selector: selector || `${tagName}:nth-of-type(${index + 1})`
          });
        });
        
        return result;
      });

      const issues: Array<{
        type: 'missing-h1' | 'multiple-h1' | 'skipped-level' | 'empty-heading' | 'first-not-h1' | 'duplicate-headings' | 'generic-heading' | 'very-long-heading' | 'very-short-heading';
        description: string;
        wcagReference?: string;
        affectedHeadings?: Array<{ level: number; text: string; selector?: string }>;
      }> = [];
      
      const h1Count = headings.filter(h => h.level === 1).length;
      const h1Headings = headings.filter(h => h.level === 1);
      
      if (h1Count === 0) {
        issues.push({
          type: 'missing-h1',
          description: 'Stránka neobsahuje žádný hlavní nadpis <h1>. Každá stránka by měla mít právě jeden h1.',
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: []
        });
      } else if (h1Count > 1) {
        issues.push({
          type: 'multiple-h1',
          description: `Stránka obsahuje ${h1Count} nadpisů h1. Měl by existovat pouze jeden hlavní nadpis.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: h1Headings
        });
      }

      for (let i = 1; i < headings.length; i++) {
        const prevLevel = headings[i - 1].level;
        const currLevel = headings[i].level;
        
        if (currLevel > prevLevel + 1) {
          issues.push({
            type: 'skipped-level',
            description: `Přeskočena úroveň nadpisu: z h${prevLevel} na h${currLevel}. Nadpisy by měly postupovat sekvenčně (h1 → h2 → h3...).`,
            wcagReference: '1.3.1 Info and Relationships',
            affectedHeadings: [headings[i - 1], headings[i]]
          });
          break;
        }
      }

      const emptyHeadings = headings.filter(h => !h.text || h.text.length === 0);
      if (emptyHeadings.length > 0) {
        issues.push({
          type: 'empty-heading',
          description: `Nalezeno ${emptyHeadings.length} prázdných nadpisů. Všechny nadpisy by měly obsahovat smysluplný text.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: emptyHeadings
        });
      }

      // Check if first heading is not H1
      if (headings.length > 0 && headings[0].level !== 1) {
        issues.push({
          type: 'first-not-h1',
          description: `První nadpis na stránce je H${headings[0].level} místo H1. Stránka by měla začínat hlavním nadpisem H1.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: [headings[0]]
        });
      }

      // Check for duplicate headings (same level, same text)
      const duplicates = new Map<string, Array<typeof headings[0]>>();
      headings.forEach(h => {
        if (h.text && h.text.length > 0) {
          const key = `${h.level}:${h.text.toLowerCase().trim()}`;
          if (!duplicates.has(key)) {
            duplicates.set(key, []);
          }
          duplicates.get(key)!.push(h);
        }
      });

      duplicates.forEach((group, key) => {
        if (group.length > 1) {
          const level = group[0].level;
          const text = group[0].text;
          issues.push({
            type: 'duplicate-headings',
            description: `Nalezeno ${group.length} identických nadpisů H${level}: "${text}". Každý nadpis by měl být unikátní pro lepší navigaci.`,
            wcagReference: '2.4.6 Headings and Labels',
            affectedHeadings: group
          });
        }
      });

      // Check for generic/non-descriptive headings
      const genericTerms = ['klikněte zde', 'click here', 'více', 'more', 'read more', 'číst více', 'zde', 'here', 'další', 'next', 'předchozí', 'previous'];
      const genericHeadings = headings.filter(h => {
        const text = h.text.toLowerCase().trim();
        return genericTerms.some(term => text === term || text.includes(term));
      });

      if (genericHeadings.length > 0) {
        issues.push({
          type: 'generic-heading',
          description: `Nalezeno ${genericHeadings.length} generických nadpisů (např. "Více", "Klikněte zde"). Nadpisy by měly být deskriptivní a popisovat obsah sekce.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: genericHeadings
        });
      }

      // Check for very long headings (>100 characters)
      const longHeadings = headings.filter(h => h.text && h.text.length > 100);
      if (longHeadings.length > 0) {
        issues.push({
          type: 'very-long-heading',
          description: `Nalezeno ${longHeadings.length} velmi dlouhých nadpisů (>100 znaků). Nadpisy by měly být stručné a výstižné.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: longHeadings
        });
      }

      // Check for very short headings (1-2 characters)
      const shortHeadings = headings.filter(h => h.text && h.text.trim().length > 0 && h.text.trim().length <= 2);
      if (shortHeadings.length > 0) {
        issues.push({
          type: 'very-short-heading',
          description: `Nalezeno ${shortHeadings.length} velmi krátkých nadpisů (1-2 znaky). Nadpisy by měly být smysluplné a deskriptivní.`,
          wcagReference: '2.4.6 Headings and Labels',
          affectedHeadings: shortHeadings
        });
      }

      console.log(`[WebScanner] Found ${headings.length} headings with ${issues.length} issues.`);

      return {
        headings,
        issues
      };
    } catch (error) {
      console.warn('[WebScanner] Failed to extract heading structure:', error);
      return {
        headings: [],
        issues: []
      };
    }
  }
}
