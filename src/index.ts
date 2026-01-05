import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { WebScanner, ScanDevice } from './core/WebScanner';
import { Crawler } from './core/Crawler';
export { stripeWebhookHandler } from './handlers/StripeWebhookHandler';
export { scanSchedulerHandler } from './handlers/ScanScheduler';
export { historyHandler } from './handlers/HistoryHandler';
import { AuditReport, CrawlSummary } from './core/types';

// Export WebScanner pro externí použití
export { WebScanner, ScanDevice } from './core/WebScanner';

// Export Differ for CLI and programmatic use
export { AccessibilityDiffer } from './core/Differ';
export type { DiffResult } from './core/Differ';

// Export types
export type { AuditReport, CrawlSummary } from './core/types';

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
  };

  try {
    // 1. SECURITY CHECK
    // Lambda headers jsou case-insensitive, ale pro jistotu kontrolujeme obě varianty
    const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
    const requiredKey = process.env.A11Y_API_KEY;

    if (requiredKey && apiKey !== requiredKey) {
      console.warn('⛔ Unauthorized access attempt.');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing API Key' }),
      };
    }

    // 2. PARSE BODY
    if (!event.body) throw new Error('Missing body');
    const body = JSON.parse(event.body);
    const url = body.url;
    const mode = body.mode || 'single';

    // Volitelný přepínač pro zařízení / profil (desktop, mobile, tablet, low-vision, reduced-motion)
    const rawDevice = (body.device || 'desktop') as string;
    const allowedDevices: ScanDevice[] = [
      'desktop',
      'mobile',
      'tablet',
      'low-vision',
      'reduced-motion',
    ];
    const device: ScanDevice = allowedDevices.includes(rawDevice as ScanDevice)
      ? (rawDevice as ScanDevice)
      : 'desktop';

    // Volitelný limit pro crawl – chráníme se horním stropem
    const requestedMaxPages = Number(body.maxPages) || 5;
    const maxPages = Math.min(Math.max(requestedMaxPages, 1), 50); // 1–50 stránek

    if (!url) throw new Error('Missing "url"');

    console.log(`🚀 Processing ${mode} request for: ${url}`);

    let result: AuditReport | CrawlSummary;

    // 3. EXECUTE
    if (mode === 'crawl') {
      // Crawl režim – počet stránek je konfigurovatelný přes body.maxPages (s limitem 50)
      const crawler = new Crawler(maxPages, { device });
      result = await crawler.crawl(url);
    } else {
      const scanner = new WebScanner();
      try {
        result = await scanner.scan(url, { device });
      } finally {
        await scanner.closeBrowser();
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Handler Critical Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
    };
  }
};