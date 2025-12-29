const https = require('https');

// 🚨 SEM VLOŽ URL TVÉ LAMBDA FUNKCE Z AWS KONZOLE
const LAMBDA_URL = "https://k7osdp3tjlstawtn2ujnk3mqlq0klaui.lambda-url.eu-central-1.on.aws/"; 

if (LAMBDA_URL.includes("tvoje-lambda")) {
    console.error("❌ CHYBA: Musíš upravit LAMBDA_URL v souboru test-live.js!");
    process.exit(1);
}

const payload = JSON.stringify({
    url: "https://www.seznam.cz/" // Testujeme na jednoduché stránce
});

console.log(`🚀 Sending request to Lambda: ${LAMBDA_URL}`);

const req = https.request(LAMBDA_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
    }
}, (res) => {
    let data = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            if (res.statusCode !== 200) {
                console.error("❌ Lambda Error:", data);
                return;
            }
            
            const report = JSON.parse(data);
            console.log("\n✅ SCAN SUCCESSFUL!");
            console.log(`Target: ${report.url}`);
            console.log(`Score: ${report.score}/100`);
            console.log(`Violations: ${report.stats.totalViolations}`);
            
            // Kontrola screenshotů
            const hasScreenshots = report.violations.critical.some(v => v.nodes.some(n => n.screenshotUrl));
            if (hasScreenshots) {
                console.log("📸 Screenshots detected in report!");
            } else {
                console.log("⚠️ No screenshots found (Bucket might not be configured).");
            }

        } catch (e) {
            console.error("❌ Failed to parse response:", e);
            console.log("Raw output:", data);
        }
    });
});

req.on('error', (e) => {
    console.error(`❌ Request error: ${e.message}`);
});

req.write(payload);
req.end();