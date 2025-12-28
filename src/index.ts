// src/index.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { WebScanner } from './core/WebScanner';

/**
 * Toto je náš AWS Lambda Handler.
 * Slouží jako "Adapter" mezi světem AWS API Gateway a naší doménovou logikou.
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    
    // 1. Parsing Inputu (Validace vstupu)
    let url: string | null = null;

    try {
        if (event.body) {
            const body = JSON.parse(event.body);
            url = body.url;
        } else if (event.queryStringParameters && event.queryStringParameters.url) {
            // Umožníme testovat i přes ?url=https://...
            url = event.queryStringParameters.url;
        }

        if (!url) {
            return buildResponse(400, { error: 'Missing "url" parameter.' });
        }

        // 2. Volání Core Logiky (Tady záříme!)
        console.log(`[START] Starting scan for: ${url}`);
        const scanner = new WebScanner(url);
        const result = await scanner.scan();
        console.log(`[SUCCESS] Found ${result.violations.length} violations.`);

        // 3. Return Output
        return buildResponse(200, result);

    } catch (error: any) {
        console.error('[ERROR]', error);
        return buildResponse(500, {
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

/**
 * Pomocná funkce pro tvorbu HTTP odpovědi (DRY principle).
 * Přidáváme CORS hlavičky, aby to šlo volat z frontend dashboardu.
 */
const buildResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // CORS (důležité pro tvůj budoucí dashboard)
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
        },
        body: JSON.stringify(body)
    };
};