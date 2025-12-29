import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { AuditReport, AccessibilityViolation } from './types';
import { ViolationMapper } from './ViolationMapper';
import { ScreenshotCapturer } from './ScreenshotCapturer';

// Použijeme klasický require, který je dostupný v Node.js CommonJS bundlu.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AxePuppeteer } = require('@axe-core/puppeteer');

export class WebScanner {
  private browser: Browser | null = null;
  private screenshotCapturer: ScreenshotCapturer;

  constructor() {
    this.screenshotCapturer = new ScreenshotCapturer();
  }

  public async scan(url: string): Promise<AuditReport> {
    let page: Page | null = null;

    try {
      await this.initBrowser();

      if (!this.browser) {
        throw new Error('Failed to initialize browser instance.');
      }

      page = await this.browser.newPage();
      
      await page.setUserAgent('A11yFlow-Bot/1.0 (Compliance Audit; +https://a11yflow.com)');
      await page.setViewport({ width: 1280, height: 800 });

      // Optimalizace: Network Idle čekání
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });

      // --- 1. AXE ANALÝZA ---
      const results = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // --- 2. MAPOVÁNÍ DAT ---
      const report = ViolationMapper.mapToReport(url, results);

      // --- 3. SCREENSHOT ENRICHMENT (NOVÉ) ---
      // Obohacujeme pouze kritické chyby, abychom šetřili čas a zdroje Lambdy
      // Limitujeme na max 5 screenshotů na typ chyby, aby report nebyl obří
      await this.enrichViolationsWithScreenshots(page, report.violations.critical);

      return report;

    } catch (error) {
      console.error(`Scanner Error processing ${url}:`, error);
      throw error;
    } finally {
      if (page) await page.close();
      if (this.browser) await this.browser.close();
    }
  }

  /**
   * Projde seznam violations a pokusí se pořídit screenshoty.
   * Modifikuje report "in-place" (side-effect design, ale efektivní pro memory).
   */
  private async enrichViolationsWithScreenshots(page: Page, violations: AccessibilityViolation[]) {
    // Pokud není bucket nastaven, Capturer se sám vypne, ale pro jistotu:
    if (!process.env.A11Y_SCREENSHOT_BUCKET) return;

    for (const violation of violations) {
      // Limit: vezmeme jen prvních 3 instance dané chyby
      const nodesToCapture = violation.nodes.slice(0, 3);
      
      for (const node of nodesToCapture) {
        const url = await this.screenshotCapturer.captureAndUpload(page, node);
        if (url) {
          node.screenshotUrl = url;
        }
      }
    }
  }

  private async initBrowser(): Promise<void> {
    const isLambda = process.env.AWS_LAMBDA_FUNCTION_VERSION !== undefined;

    const launchOptions = isLambda
      ? {
          args: chromium.args,
          defaultViewport: (chromium as any).defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: (chromium as any).headless,
          ignoreHTTPSErrors: true,
        }
      : {
          channel: 'chrome',
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

    this.browser = await puppeteer.launch(launchOptions as any);
  }
}