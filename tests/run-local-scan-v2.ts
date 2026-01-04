
import { WebScanner } from './src/core/WebScanner';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
    console.log("Starting local scan (screenshots disabled)...");
    const scanner = new WebScanner();
    
    // Use Wikipedia again as it has good content for scrolling
    const url = 'https://cs.wikipedia.org/wiki/Hlavní_strana'; 
    
    try {
        const result = await scanner.scan(url);
        
        const timestamp = Date.now();
        const filename = `report-${timestamp}.json`;
        const filepath = path.join(process.cwd(), filename);
        
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
        console.log(`Report saved to ${filepath}`);
        
        if (result.fullPageScreenshot) {
            console.log("Screenshot captured successfully (length: " + result.fullPageScreenshot.length + ")");
        } else {
            console.warn("No screenshot captured.");
        }
        
    } catch (error) {
        console.error("Scan failed:", error);
    }
})();
