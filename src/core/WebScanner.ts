// src/core/WebScanner.ts
import { Browser, Page } from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { Result } from 'axe-core';

// Flexibilní importy pro různé prostředí
// Puppeteer pro lokální vývoj, Core+Chromium pro AWS
const puppeteer = require(process.env.AWS_LAMBDA_FUNCTION_NAME ? 'puppeteer-core' : 'puppeteer');
const chromium = process.env.AWS_LAMBDA_FUNCTION_NAME ? require('@sparticuz/chromium') : null;

// DTO pro výsledek (Clean Code: Data Structures)
export interface AuditResult {
    url: string;
    timestamp: string;
    violations: Result[];
}

export class WebScanner {
    private readonly url: string;

    constructor(url: string) {
        this.url = url;
    }

    /**
     * Hlavní metoda orchestrace auditu.
     * Dodržuje "Step-down rule" - čteme odshora dolů.
     */
    public async scan(): Promise<AuditResult> {
        let browser: Browser | null = null;
        try {
            browser = await this.launchBrowser();
            const page = await this.setupPage(browser);
            const violations = await this.analyzeAccessibility(page);
            
            return this.constructResult(violations);
        } catch (error: any) {
            throw new Error(`A11yFlow Scan Failed for ${this.url}: ${error.message}`);
        } finally {
            if (browser) await browser.close();
        }
    }

    // --- Private Implementation Details ---

    private async launchBrowser(): Promise<Browser> {
        const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

        if (isLambda) {
            return await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless,
            });
        } else {
            // Lokální konfigurace (Localhost)
            return await puppeteer.launch({
                headless: "new", // Moderní headless mód
                args: ['--no-sandbox']
            });
        }
    }

    private async setupPage(browser: Browser): Promise<Page> {
        const page = await browser.newPage();
        // Networkidle0 zajistí, že se načte i JS (Single Page Apps)
        await page.goto(this.url, { waitUntil: 'networkidle0' });
        return page;
    }

    private async analyzeAccessibility(page: Page): Promise<Result[]> {
        const results = await new AxePuppeteer(page)
            .withTags(['wcag21aa', 'wcag2aa']) // Cílíme na standard WCAG 2.1 AA
            .analyze();
        return results.violations;
    }

    private constructResult(violations: Result[]): AuditResult {
        return {
            url: this.url,
            timestamp: new Date().toISOString(),
            violations: violations
        };
    }
}