// src/core/WebScanner.test.ts
import { WebScanner } from './WebScanner';

const RUN_BROWSER_TESTS = process.env.RUN_BROWSER_TESTS === 'true';

// Popisujeme chování, ne implementaci (Behavior Driven Development style)
describe('A11yFlow WebScanner', () => {
    
    // Čistý kód: SetUp (Arrange)
    const TEST_URL = 'https://prehrajto.cz/';
    // Používáme delší timeout, protože spouštění browseru chvíli trvá
    jest.setTimeout(30000); 

    it('should successfully initialize', () => {
        const scanner = new WebScanner();
        expect(scanner).toBeDefined();
    });

    (RUN_BROWSER_TESTS ? it : it.skip)('should scan a url and return accessibility violations', async () => {
        const scanner = new WebScanner();
        
        // Act
        const result = await scanner.scan(TEST_URL);

        // Assert
        // Ověřujeme kontrakt - strukturu dat
        expect(result).toBeDefined();
        expect(result.url).toBe(TEST_URL);
        expect(result.violations).toBeDefined();
        expect(Array.isArray(result.violations.critical)).toBe(true);
        
        // Logování pro tvojí kontrolu (později smažeme - Clean Code nemá mít console.log v testech)
        console.log(`Nalezeno ${result.stats.totalViolations} chyb na ${TEST_URL}`);
    });
});