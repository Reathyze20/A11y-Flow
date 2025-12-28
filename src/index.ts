import { WebScanner } from './core/WebScanner';
import { AuditReport } from './core/types';

/**
 * Lambda Handler
 * Vstup: HTTP POST body { "url": "..." }
 * Výstup: JSON AuditReport
 */
export const handler = async (
  event: AWSLambda.APIGatewayProxyEvent
): Promise<AWSLambda.APIGatewayProxyResult> => {
  // CORS hlavičky pro volání z frontendu nebo Make.com
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
  };

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    const body = JSON.parse(event.body);
    const url = body.url;

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing "url" parameter in body' }),
      };
    }

    const scanner = new WebScanner();
    const report: AuditReport = await scanner.scan(url);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(report),
    };

  } catch (error) {
    console.error('Lambda Handler Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal Server Error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
    };
  }
};