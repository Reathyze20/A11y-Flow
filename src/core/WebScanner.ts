import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { AuditReport } from './types';
import { ViolationMapper } from './ViolationMapper';

// Workaround pro Axe-puppeteer v ESM - používáme CommonJS require
// Jest i Node runtime (CommonJS bundle) mají require k dispozici.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AxePuppeteer } = require('@axe-core/puppeteer');

export class WebScanner {
  private browser: Browser | null = null;

  /**
   * Provede scan stránky a vrátí strukturovaný AuditReport.
   */
  public async scan(url: string): Promise<AuditReport> {
    let page: Page | null = null;

    try {
      await this.initBrowser();

      if (!this.browser) {
        throw new Error('Failed to initialize browser instance.');
      }

      page = await this.browser.newPage();
      
      // Nastavení User-Agenta pro identifikaci bota
      await page.setUserAgent('A11yFlow-Bot/1.0 (Compliance Audit; +https://a11yflow.com)');

      // Viewport pro desktop audit
      await page.setViewport({ width: 1280, height: 800 });

      // Navigace s robustním timeoutem
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 30000 
      });

      // Spuštění Axe-core analýzy
      // Cílíme na standardy vyžadované EAA 2025 (WCAG 2.1 AA)
      const results = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Transformace dat na čistý report
      const report = ViolationMapper.mapToReport(url, results);

      return report;

    } catch (error) {
      console.error(`Scanner Error processing ${url}:`, error);
      throw error;
    } finally {
      // Cleanup resources - kritické pro AWS Lambda
      if (page) await page.close();
      if (this.browser) await this.browser.close();
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