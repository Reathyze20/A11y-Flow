// src/core/WebScanner.test.ts
import { WebScanner } from './WebScanner';

// Popisujeme chování, ne implementaci (Behavior Driven Development style)
describe('A11yFlow WebScanner', () => {
    
    // Čistý kód: SetUp (Arrange)
    const TEST_URL = 'https://prehrajto.cz/';
    // Používáme delší timeout, protože spouštění browseru chvíli trvá
    jest.setTimeout(30000); 

    it('should successfully initialize', () => {
        const scanner = new WebScanner(TEST_URL);
        expect(scanner).toBeDefined();
    });

    it('should scan a url and return accessibility violations', async () => {
        const scanner = new WebScanner(TEST_URL);
        
        // Act
        const result = await scanner.scan();

        // Assert
        // Ověřujeme kontrakt - strukturu dat
        expect(result).toBeDefined();
        expect(result.url).toBe(TEST_URL);
        expect(Array.isArray(result.violations)).toBe(true);

        // Nově ověřujeme i doplňková metadata stránky
        expect(result.metadata).toBeDefined();
        expect(result.metadata).toHaveProperty('title');
        expect(result.metadata).toHaveProperty('description');
        expect(result.metadata).toHaveProperty('fullPageScreenshotBase64');

        if (result.metadata.fullPageScreenshotBase64 !== null) {
            expect(typeof result.metadata.fullPageScreenshotBase64).toBe('string');
        }
        
        // Logování pro tvojí kontrolu (později smažeme - Clean Code nemá mít console.log v testech)
        console.log(`Nalezeno ${result.violations.length} chyb na ${TEST_URL}`);
    });
});