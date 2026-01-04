// run-local.ts
// Důležité: Import musí ukazovat do ./src/index
import { handler } from './src/index';

// Získání URL z argumentů příkazové řádky, jinak použijeme default
const targetUrl = process.argv[2] || 'https://sso.t-mobile.cz/v2/?client_id=portal_federal&scope=openid&redirect_uri=https%3A%2F%2Fwww.t-mobile.cz%2Foauth-callback&state=https%3A%2F%2Fwww.t-mobile.cz%2Fmuj-t-mobile';

const eventMock: any = {
    // Simulujeme, že nám API Gateway poslala tento JSON
    body: JSON.stringify({ url: targetUrl }),
    headers: {
        'x-api-key': 'test-key' // Mock key, though local run might not check it if env var is not set
    }
};

(async () => {
    console.log("Simulating AWS Lambda Event...");
    try {
        const result = await handler(eventMock);
        console.log("---------------------------------------------------");
        
        const response = result as any; // Cast to any to avoid TS errors for this quick script
        
        console.log("STATUS CODE:", response.statusCode);
        // console.log("BODY:", response.body.substring(0, 200) + "..."); // Vypíšeme jen kousek, ať nezahltíme konzoli
        
        if (response.body) {
            const fs = require('fs');
            fs.writeFileSync('test-report.json', response.body);
            console.log("Full report saved to test-report.json");
        }
        console.log("---------------------------------------------------");
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
})();