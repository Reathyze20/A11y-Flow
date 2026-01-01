const https = require('https');
const fs = require('fs');
const path = require('path');

// 🚨 SEM VLOŽ URL TVÉ LAMBDA FUNKCE
const LAMBDA_URL = "https://k7osdp3tjlstawtn2ujnk3mqlq0klaui.lambda-url.eu-central-1.on.aws/"; 

// 🔐 SEM VLOŽ TVŮJ API KLÍČ
const API_KEY = "Mjiq33R41993@4682555"; 

if (LAMBDA_URL.includes("tvoje-lambda")) {
    console.error("❌ CHYBA: Musíš upravit LAMBDA_URL v souboru test-live.js!");
    process.exit(1);
}

const TEST_CONFIG = {
    url: "https://www.tesena.com/", 
    mode: "single", // nebo "single" pro jeden URL
    maxPages: 20 // kolik stránek chceš projít v rámci testu
};

const payload = JSON.stringify(TEST_CONFIG);

console.log(`🚀 Sending ${TEST_CONFIG.mode.toUpperCase()} request to: ${LAMBDA_URL}`);

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'x-api-key': API_KEY
    }
};

let spinnerInterval = null;
let elapsedSeconds = 0;
const spinnerFrames = ['|', '/', '-', '\\'];
let spinnerIndex = 0;

function startSpinner() {
    if (spinnerInterval) return;
    spinnerInterval = setInterval(() => {
        const frame = spinnerFrames[spinnerIndex % spinnerFrames.length];
        spinnerIndex += 1;
        elapsedSeconds += 1;
        process.stdout.write(`\r${frame} Pracuji na scanu... ${elapsedSeconds}s`);
    }, 1000);
}

function stopSpinner() {
    if (spinnerInterval) {
        clearInterval(spinnerInterval);
        spinnerInterval = null;
        process.stdout.write('\r');
    }
}

startSpinner();

const req = https.request(LAMBDA_URL, options, (res) => {
    let data = '';
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', chunk => data += chunk);

    res.on('end', () => {
        stopSpinner();
        if (res.statusCode !== 200) {
            console.error("⛔ CHYBA:", data);
            return;
        }

        try {
            const result = JSON.parse(data);
            
            const filename = `report-${Date.now()}.json`;
            fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(result, null, 2));
            console.log(`\n💾 Report saved to: ${filename}`);

            if (Array.isArray(result.pages)) {
                const totalPagesScanned = result.totalPagesScanned ?? result.pages.length;

                const computedTotalViolations = result.pages.reduce((sum, p) => {
                    const statsIssues = p.stats && typeof p.stats.totalViolations === 'number'
                        ? p.stats.totalViolations
                        : Array.isArray(p.violations)
                            ? p.violations.length
                            : 0;
                    return sum + statsIssues;
                }, 0);

                const totalViolations =
                    typeof result.totalViolations === 'number'
                        ? result.totalViolations
                        : computedTotalViolations;

                console.log(`\n✅ CRAWL SUCCESSFUL!`);
                console.log(`---------------------------------------------`);
                console.log(`Root URL:       ${result.rootUrl}`);
                console.log(`Pages Scanned:  ${totalPagesScanned}`);
                console.log(`Average Score:  ${result.averageScore ?? '-'} /100`);
                console.log(`Total Issues:   ${totalViolations}`);
                console.log(`Critical Only:  ${result.totalCriticalViolations}`);
                console.log(`---------------------------------------------`);
                
                console.log("Scanned URLs:");
                result.pages.forEach(p => {
                    const issues =
                        p.stats && typeof p.stats.totalViolations === 'number'
                            ? p.stats.totalViolations
                            : Array.isArray(p.violations)
                                ? p.violations.length
                                : 0;
                    console.log(` - [Score: ${p.score ?? '-'}] [Issues: ${issues}] ${p.url}`);
                });

            } else {
                const singleIssues =
                    result.stats && typeof result.stats.totalViolations === 'number'
                        ? result.stats.totalViolations
                        : Array.isArray(result.violations)
                            ? result.violations.length
                            : 0;

                console.log(`\n✅ SCAN DONE. Score: ${result.score ?? '-'}, Issues: ${singleIssues}`);
            }

        } catch (e) {
            console.error("❌ Error parsing response:", e);
        }
    });
});

req.on('error', (e) => {
    stopSpinner();
    console.error(`❌ Request error: ${e.message}`);
});
req.write(payload);
req.end();