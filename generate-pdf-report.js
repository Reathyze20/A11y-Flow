const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function usage() {
  console.error('Usage: node generate-pdf-report.js <report.html>');
  console.error('Tip: nejdřív vygeneruj HTML: npm run report:html -- report-123.json');
  process.exit(1);
}

const inputArg = process.argv[2];
if (!inputArg) usage();

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Input HTML file not found: ${inputPath}`);
  process.exit(1);
}

if (!/\.html?$/i.test(inputPath)) {
  console.error('Expected an HTML file as input (např. report-123.html).');
  process.exit(1);
}

const outputPath = inputPath.replace(/\.html?$/i, '.pdf');

(async () => {
  console.log(`[32m[1mGenerating PDF manager report[0m from: ${inputPath}`);

  const browser = await puppeteer.launch({
    headless: 'new',
  });

  try {
    const page = await browser.newPage();
    const fileUrl = 'file://' + inputPath.replace(/\\/g, '/');

    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm',
      },
    });

    console.log('PDF report generated at:', outputPath);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
