import { WebScanner, ScanOptions } from './WebScanner';
import { AuditReport, CrawlSummary } from './types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { SitemapFetcher } from './SitemapFetcher';
import { URL } from 'url';

export class Crawler {
  private scanner: WebScanner;
  private visitedUrls: Set<string> = new Set();
  private maxPages: number;
  private scanOptions: ScanOptions;

  private static historyTableName =
    process.env.HISTORY_TABLE_NAME || 'A11yFlow_History';
  private static ddbClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({})
  );

  constructor(maxPages: number = 5, scanOptions: ScanOptions = {}) {
    this.scanner = new WebScanner();
    this.maxPages = maxPages;
    this.scanOptions = scanOptions;
  }

  // Helper pro scheduler – projde web a uloží výsledek do historie.
  public async crawlAndPersist(
    customerId: string,
    startUrl: string
  ): Promise<CrawlSummary> {
    const summary = await this.crawl(startUrl);
    await Crawler.saveCrawlHistory(customerId, summary, this.scanOptions);
    return summary;
  }

  public async crawl(startUrl: string): Promise<CrawlSummary> {
    const results: AuditReport[] = [];
    const queue: string[] = [];
    const rootHostname = new URL(startUrl).hostname;

    console.log(`🕷️ Starting Smart Crawl on ${startUrl}`);

    const sitemapUrls = await SitemapFetcher.fetchSitemapUrls(startUrl);
    console.log(`🗺️ Sitemap URLs found: ${sitemapUrls.length}`);
    
    if (sitemapUrls.length > 0) {
      console.log('✅ Using Sitemap strategy.');
      // Vždy dáme root URL na začátek fronty,
      // aby se určitě aspoň jednou zkusila geskenovat
      queue.push(...sitemapUrls);
      if (!sitemapUrls.includes(startUrl)) {
        queue.unshift(startUrl);
      }
    } else {
      console.log('⚠️ Sitemap not found, using BFS strategy.');
      queue.push(startUrl);
    }

    console.log(`📥 Initial crawl queue:`, queue);

    try {
      while (queue.length > 0 && results.length < this.maxPages) {
        const currentUrl = queue.shift()!;
        const normalizedUrl = currentUrl.replace(/\/$/, "");
        
        if (this.visitedUrls.has(normalizedUrl)) continue;
        this.visitedUrls.add(normalizedUrl);

        console.log(`🔍 Scanning (${results.length + 1}/${this.maxPages}) [queue=${queue.length}, visited=${this.visitedUrls.size}]: ${currentUrl}`);

        try {
          const report = await this.scanner.scan(currentUrl, this.scanOptions);
          results.push(report);

          if (results.length < this.maxPages) {
            const links = await this.scanner.extractInternalLinks(rootHostname);
            console.log(`🧭 From ${currentUrl} found ${links.length} candidate links.`);
            links.forEach(link => {
              const normLink = link.replace(/\/$/, "");
              if (!this.visitedUrls.has(normLink)) {
                queue.push(link);
              }
            });
          }

        } catch (err) {
          console.error(`❌ Failed to scan ${currentUrl}:`, err);
        }
      }
    } finally {
      await this.scanner.closeBrowser();
    }

    return this.aggregateResults(startUrl, results);
  }

  private aggregateResults(rootUrl: string, reports: AuditReport[]): CrawlSummary {
    const totalScore = reports.reduce((acc, r) => acc + r.score, 0);
    const totalCritical = reports.reduce((acc, r) => acc + r.stats.criticalCount, 0);
    // NOVÉ: Sčítáme všechny violations ze všech stránek
    const totalViolations = reports.reduce((acc, r) => acc + r.stats.totalViolations, 0);

    // Agregace Core Web Vitals přes stránky, kde máme performance data
    let lcpSum = 0;
    let lcpCount = 0;
    let clsSum = 0;
    let clsCount = 0;
    let inpSum = 0;
    let inpCount = 0;
    let tbtSum = 0;
    let tbtCount = 0;

    for (const r of reports) {
      const perf = r.performance;
      if (!perf) continue;

      if (typeof perf.coreWebVitals.lcp === 'number') {
        lcpSum += perf.coreWebVitals.lcp;
        lcpCount++;
      }
      if (typeof perf.coreWebVitals.cls === 'number') {
        clsSum += perf.coreWebVitals.cls;
        clsCount++;
      }
      if (typeof perf.coreWebVitals.inp === 'number') {
        inpSum += perf.coreWebVitals.inp;
        inpCount++;
      }
      if (typeof perf.coreWebVitals.tbt === 'number') {
        tbtSum += perf.coreWebVitals.tbt;
        tbtCount++;
      }
    }

    const performanceSummary =
      lcpCount + clsCount + inpCount + tbtCount > 0
        ? {
            averageLcp: lcpCount > 0 ? Math.round(lcpSum / lcpCount) : null,
            averageCls: clsCount > 0 ? clsSum / clsCount : null,
            averageInp: inpCount > 0 ? Math.round(inpSum / inpCount) : null,
            averageTbt: tbtCount > 0 ? Math.round(tbtSum / tbtCount) : null,
          }
        : undefined;

    return {
      rootUrl,
      totalPagesScanned: reports.length,
      averageScore: reports.length > 0 ? Math.round(totalScore / reports.length) : 0,
      totalCriticalViolations: totalCritical,
      totalViolations, // Přidáno do výstupu
      pages: reports,
      performanceSummary,
    };
  }

  private static async saveCrawlHistory(
    customerId: string,
    summary: CrawlSummary,
    scanOptions: ScanOptions
  ): Promise<void> {
    const scanTimestamp = new Date().toISOString();
    const scanId = randomUUID();

    const item = {
      customerId,
      scanTimestamp,
      scanId,
      rootUrl: summary.rootUrl,
      score: summary.averageScore,
      totalIssues: summary.totalViolations,
      criticalIssues: summary.totalCriticalViolations,
      mode: 'crawl',
      device: scanOptions.device === 'mobile' ? 'mobile' : 'desktop',
      reportJsonUrl: '', // Rezervované místo pro budoucí uložení JSONu do S3
      performanceSummary: summary.performanceSummary,
      createdAt: scanTimestamp,
    };

    await this.ddbClient.send(
      new PutCommand({
        TableName: this.historyTableName,
        Item: item,
      })
    );
  }
}