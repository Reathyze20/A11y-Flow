const fs = require('fs');
const path = require('path');
const { WebScanner } = require('./dist/index.js');

// Jednoduchý CLI nástroj pro scénářové audity (user flows)
// Použití:
//   npm run build
//   node run-flow.js registration https://www.example.com
// nebo
//   node run-flow.js checkout https://www.example.com

const flowId = process.argv[2] || 'registration';
const baseUrl = process.argv[3] || 'https://example.com';

if (!baseUrl.startsWith('http')) {
  console.error('❌ Musíš zadat base URL, např.: node run-flow.js registration https://www.example.com');
  process.exit(1);
}

// Demo flow definice – uprav selektory pro svůj web
const flows = {
  registration: {
    id: 'registration',
    label: 'Registrace – demo scénář',
    steps: [
      {
        id: 'step-1',
        label: 'Otevřít homepage',
        type: 'goto',
        url: baseUrl,
      },
      {
        id: 'step-2',
        label: 'Otevřít formulář registrace',
        type: 'click',
        selector: 'a[href*="register"], a[href*="signup"], a[href*="registrace"]',
      },
      {
        id: 'step-3',
        label: 'Vyplnit e-mail',
        type: 'type',
        selector: 'input[type="email"]',
        text: 'demo@example.com',
      },
      {
        id: 'step-4',
        label: 'Vyplnit heslo',
        type: 'type',
        selector: 'input[type="password"]',
        text: 'DemoHeslo123!',
      },
      {
        id: 'step-5',
        label: 'Odeslat registraci (Enter na primárním tlačítku)',
        type: 'press',
        key: 'Enter',
        expectUrlIncludes: 'confirm',
      },
    ],
  },
  checkout: {
    id: 'checkout',
    label: 'Checkout – demo scénář',
    steps: [
      {
        id: 'step-1',
        label: 'Otevřít homepage',
        type: 'goto',
        url: baseUrl,
      },
      {
        id: 'step-2',
        label: 'Přidat produkt do košíku',
        type: 'click',
        selector: 'button[name*="add" i], button[id*="add-to-cart" i], button[class*="add-to-cart" i]',
      },
      {
        id: 'step-3',
        label: 'Přejít do košíku',
        type: 'click',
        selector: 'a[href*="cart" i], a[href*="kosik" i]',
      },
      {
        id: 'step-4',
        label: 'Přejít na dopravu',
        type: 'click',
        selector: 'button, a[href*="shipping" i]'
      },
      {
        id: 'step-5',
        label: 'Přejít na platbu',
        type: 'click',
        selector: 'button, a[href*="payment" i]'
      },
    ],
  },
};

const flow = flows[flowId];

if (!flow) {
  console.error(`❌ Neznámý flow "${flowId}". Dostupné: ${Object.keys(flows).join(', ')}`);
  process.exit(1);
}

(async () => {
  console.log(`\n🚀 Spouštím scénářový audit: ${flow.label} (${flow.id})`);
  console.log(`   Base URL: ${baseUrl}`);

  const scanner = new WebScanner();

  try {
    const report = await scanner.runUserFlow(flow, { device: 'desktop' });

    console.log(`\n📊 Výsledek scénáře: ${report.label}`);
    console.log(`   Status: ${report.status}`);

    // Najdeme první krok, kde scénář padl nebo má a11y problémy
    const firstFailed = report.steps.find((s) => !s.success);
    const firstA11y = report.steps.find((s) => s.keyboardIssues && s.keyboardIssues.length > 0);

    if (firstFailed) {
      console.log(
        `❌ Scénář "${report.label}" selhal v kroku ${firstFailed.index + 1}: ${firstFailed.label}`
      );
      if (firstFailed.errorMessage) {
        console.log(`   Důvod: ${firstFailed.errorMessage}`);
      }
    }

    if (!firstFailed && firstA11y) {
      console.log(
        `⚠️  Scénář "${report.label}" je neprojdutelný klávesnicí v kroku ${
          firstA11y.index + 1
        }: ${firstA11y.label}`
      );
      console.log(
        `   Nalezené problémy s klávesnicí: ${firstA11y.keyboardIssues.length}`
      );
    }

    console.log('\n📜 Detaily kroků:');
    for (const step of report.steps) {
      const marker = !step.success
        ? '❌'
        : step.keyboardIssues && step.keyboardIssues.length > 0
        ? '⚠️ '
        : '✅';

      console.log(
        ` ${marker} [krok ${step.index + 1}] ${step.label} – success=${step.success} URL=${
          step.urlAfter || '-'
        }`
      );

      if (step.errorMessage) {
        console.log(`    • Chyba: ${step.errorMessage}`);
      }

      if (step.keyboardIssues && step.keyboardIssues.length > 0) {
        const sampleIssue = step.keyboardIssues[0];
        console.log(
          `    • Klávesnicové problémy: ${step.keyboardIssues.length} (např. ${
            sampleIssue.description || sampleIssue.type
          })`
        );
      }
    }

    const filename = `flow-report-${flow.id}-${Date.now()}.json`;
    const fullPath = path.join(__dirname, filename);
    fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n💾 Flow report uložen do: ${filename}`);
  } catch (e) {
    console.error('CRITICAL ERROR in flow runner:', e);
  } finally {
    await scanner.closeBrowser();
  }
})();
