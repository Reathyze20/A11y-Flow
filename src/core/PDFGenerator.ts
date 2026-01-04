import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { AuditReport } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PDFGenerator
 * 
 * Generuje PDF report z HTML reportu pomocí Puppeteer.
 * Používá se pro white-label reports pro agentury a klienty.
 */
export class PDFGenerator {
  private browser: Browser | null = null;

  /**
   * Vygeneruje PDF report z audit dat
   * 
   * @param reportData Complete audit report data
   * @param options PDF generation options
   * @returns PDF as Buffer
   */
  async generatePDF(
    reportData: AuditReport,
    options: PDFGenerationOptions = {}
  ): Promise<Buffer> {
    try {
      console.log('[PDFGenerator] Generating PDF report...');

      // Launch browser if not already running
      if (!this.browser) {
        await this.launchBrowser();
      }

      if (!this.browser) {
        throw new Error('Failed to launch browser');
      }

      const page = await this.browser.newPage();

      // Generate HTML content
      const html = this.generateHTMLReport(reportData, options);

      // Set content and wait for rendering
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Generate PDF with proper options
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '15mm',
          right: '15mm'
        },
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(reportData, options),
        footerTemplate: this.getFooterTemplate(reportData, options),
      });

      await page.close();

      console.log('[PDFGenerator] PDF generated successfully.');
      return Buffer.from(pdfBuffer);

    } catch (error) {
      console.error('[PDFGenerator] Failed to generate PDF:', error);
      throw error;
    }
  }

  /**
   * Generuje HTML content pro PDF
   * Používá generate-html-report.js logiku, ale s PDF-optimalizací
   */
  private generateHTMLReport(
    reportData: AuditReport,
    options: PDFGenerationOptions
  ): string {
    // V reálné implementaci bychom zde použili logiku z generate-html-report.js
    // Pro teď použijeme zjednodušenou verzi
    
    const score = reportData.score;
    const url = reportData.url;
    const timestamp = new Date(reportData.timestamp).toLocaleString('cs-CZ');
    
    const criticalCount = reportData.violations.critical.length;
    const seriousCount = reportData.violations.serious.length;
    const moderateCount = reportData.violations.moderate.length;
    const minorCount = reportData.violations.minor.length;

    const totalViolations = reportData.stats.totalViolations;

    // White-label branding
    const branding = options.whiteLabelbranding || {
      companyName: 'A11y-Flow',
      logo: '',
      color: '#2563eb'
    };

    return `
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${this.escapeHtml(url)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        .container { max-width: 100%; padding: 20px; }
        
        /* Header */
        .report-header {
            border-bottom: 3px solid ${branding.color};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .report-header h1 {
            color: ${branding.color};
            font-size: 28px;
            margin-bottom: 10px;
        }
        .report-header .meta {
            color: #666;
            font-size: 14px;
        }
        
        /* Score Card */
        .score-card {
            background: linear-gradient(135deg, ${branding.color} 0%, #1e40af 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
        }
        .score-card .score {
            font-size: 72px;
            font-weight: bold;
            margin: 10px 0;
        }
        .score-card .label {
            font-size: 18px;
            opacity: 0.9;
        }
        
        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .stat-card.critical { border-left: 4px solid #ef4444; }
        .stat-card.serious { border-left: 4px solid #f59e0b; }
        .stat-card.moderate { border-left: 4px solid #eab308; }
        .stat-card.minor { border-left: 4px solid #3b82f6; }
        .stat-card .number {
            font-size: 36px;
            font-weight: bold;
            color: #333;
        }
        .stat-card .label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            margin-top: 5px;
        }
        
        /* Violations Section */
        .violations-section {
            margin-top: 30px;
        }
        .violations-section h2 {
            font-size: 24px;
            margin-bottom: 20px;
            color: ${branding.color};
        }
        .violation-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            page-break-inside: avoid;
        }
        .violation-card.critical { border-left: 4px solid #ef4444; }
        .violation-card.serious { border-left: 4px solid #f59e0b; }
        .violation-card h3 {
            font-size: 18px;
            margin-bottom: 10px;
            color: #333;
        }
        .violation-card .description {
            color: #666;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .violation-card .fix {
            background: #f9fafb;
            border-left: 3px solid #10b981;
            padding: 10px;
            margin-top: 10px;
            font-size: 13px;
        }
        .violation-card .fix strong {
            color: #10b981;
        }
        
        /* Page breaks */
        .page-break { page-break-before: always; }
        
        /* Footer */
        .report-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="report-header">
            ${branding.logo ? `<img src="${branding.logo}" alt="${branding.companyName}" style="max-width: 200px; margin-bottom: 20px;">` : ''}
            <h1>Accessibility Audit Report</h1>
            <div class="meta">
                <div><strong>Testovaná URL:</strong> ${this.escapeHtml(url)}</div>
                <div><strong>Datum analýzy:</strong> ${timestamp}</div>
                ${options.whiteLabelbranding ? `<div><strong>Připraveno pro:</strong> ${this.escapeHtml(branding.companyName)}</div>` : ''}
            </div>
        </div>
        
        <!-- Score Card -->
        <div class="score-card">
            <div class="label">Celkové skóre přístupnosti</div>
            <div class="score">${score}/100</div>
            <div class="label">WCAG 2.1 Level AA Compliance</div>
        </div>
        
        <!-- Stats Grid -->
        <div class="stats-grid">
            <div class="stat-card critical">
                <div class="number">${criticalCount}</div>
                <div class="label">Critical</div>
            </div>
            <div class="stat-card serious">
                <div class="number">${seriousCount}</div>
                <div class="label">Serious</div>
            </div>
            <div class="stat-card moderate">
                <div class="number">${moderateCount}</div>
                <div class="label">Moderate</div>
            </div>
            <div class="stat-card minor">
                <div class="number">${minorCount}</div>
                <div class="label">Minor</div>
            </div>
        </div>
        
        <!-- Annotated Screenshot -->
        ${reportData.annotatedScreenshot ? `
        <div style="margin: 30px 0; page-break-inside: avoid;">
            <h2 style="font-size: 24px; margin-bottom: 15px; color: ${branding.color};">Visual Error Map</h2>
            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">
                Červené značky ukazují umístění kritických a závažných problémů na stránce:
            </p>
            <img src="data:image/jpeg;base64,${reportData.annotatedScreenshot}" 
                 alt="Annotated screenshot" 
                 style="width: 100%; border: 1px solid #ddd; border-radius: 8px;" />
        </div>
        ` : ''}
        
        <!-- Critical Violations -->
        ${criticalCount > 0 ? `
        <div class="violations-section page-break">
            <h2>🔴 Kritické problémy (${criticalCount})</h2>
            ${reportData.violations.critical.map(v => `
                <div class="violation-card critical">
                    <h3>${this.escapeHtml(v.title)}</h3>
                    <div class="description">${this.escapeHtml(v.description)}</div>
                    <div><strong>Počet výskytů:</strong> ${v.count}</div>
                    ${v.suggestedFix ? `
                        <div class="fix">
                            <strong>💡 Jak opravit:</strong><br>
                            ${this.escapeHtml(v.suggestedFix)}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <!-- Serious Violations -->
        ${seriousCount > 0 ? `
        <div class="violations-section ${criticalCount > 3 ? 'page-break' : ''}">
            <h2>🟠 Závažné problémy (${seriousCount})</h2>
            ${reportData.violations.serious.slice(0, 10).map(v => `
                <div class="violation-card serious">
                    <h3>${this.escapeHtml(v.title)}</h3>
                    <div class="description">${this.escapeHtml(v.description)}</div>
                    <div><strong>Počet výskytů:</strong> ${v.count}</div>
                    ${v.suggestedFix ? `
                        <div class="fix">
                            <strong>💡 Jak opravit:</strong><br>
                            ${this.escapeHtml(v.suggestedFix)}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
            ${seriousCount > 10 ? `<p style="color: #666; font-style: italic;">... a dalších ${seriousCount - 10} problémů</p>` : ''}
        </div>
        ` : ''}
        
        <!-- Footer -->
        <div class="report-footer">
            <p>Tento report byl automaticky vygenerován pomocí A11y-Flow</p>
            <p>Pro více informací navštivte: https://a11yflow.com</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Header template pro PDF
   */
  private getHeaderTemplate(reportData: AuditReport, options: PDFGenerationOptions): string {
    return `
      <div style="font-size: 10px; text-align: center; width: 100%; color: #666; margin-top: 10px;">
        ${options.whiteLabelbranding?.companyName || 'A11y-Flow'} - Accessibility Report
      </div>
    `;
  }

  /**
   * Footer template pro PDF
   */
  private getFooterTemplate(reportData: AuditReport, options: PDFGenerationOptions): string {
    return `
      <div style="font-size: 9px; text-align: center; width: 100%; color: #999; margin-bottom: 10px;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `;
  }

  /**
   * Escape HTML for security
   */
  private escapeHtml(str: string): string {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Launch Puppeteer browser
   */
  private async launchBrowser(): Promise<void> {
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

    let executablePath: string | undefined;

    if (isLambda) {
      executablePath = await chromium.executablePath();
    } else {
      // Local development
      const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      executablePath = localExecutablePath || undefined;
    }

    const launchOptions = isLambda
      ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        }
      : {
          executablePath,
          channel: executablePath ? undefined : ('chrome' as any),
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

    this.browser = await puppeteer.launch(launchOptions as any);
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * PDF Generation Options
 */
export interface PDFGenerationOptions {
  whiteLabelbranding?: {
    companyName: string;
    logo?: string; // URL or base64
    color?: string; // Hex color
  };
  includeScreenshots?: boolean;
  maxViolationsPerCategory?: number;
}
