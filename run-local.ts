// run-local.ts
// Důležité: Import musí ukazovat do ./src/index
import { handler } from './src/index';

const eventMock: any = {
    // Simulujeme, že nám API Gateway poslala tento JSON
    body: JSON.stringify({ url: 'https://example.com' })
};

(async () => {
    console.log("Simulating AWS Lambda Event...");
    try {
        const result = await handler(eventMock);
        console.log("---------------------------------------------------");
        console.log("STATUS CODE:", result.statusCode);
        console.log("BODY:", result.body.substring(0, 200) + "..."); // Vypíšeme jen kousek, ať nezahltíme konzoli
        console.log("---------------------------------------------------");
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
})();