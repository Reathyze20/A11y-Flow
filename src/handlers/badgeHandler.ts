import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { BadgeService, BadgeStyle } from '../core/BadgeService.js';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const SCANS_TABLE = process.env.SCANS_TABLE || 'a11yflow-scans';

/**
 * Lambda Handler for Dynamic Accessibility Badge
 * 
 * Endpoint: GET /badge/{domainHash}.svg
 * 
 * Returns an SVG badge showing the latest accessibility score for a domain.
 * The badge is cached via CloudFront for 1 hour to reduce Lambda costs.
 * 
 * Query Parameters:
 * - style: 'default' | 'flat' | 'compact' | 'shield' (optional, default: 'default')
 * 
 * Response:
 * - 200: SVG image
 * - 404: Domain not found
 * - 500: Server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  try {
    // Extract domainHash from path (e.g., /badge/abc123def456.svg)
    const pathParam = event.pathParameters?.domainHash;
    
    if (!pathParam) {
      return generateErrorBadge('Invalid request', corsHeaders);
    }

    // Remove .svg extension if present
    const domainHash = pathParam.replace(/\.svg$/, '');

    console.log(`[badgeHandler] Generating badge for domainHash: ${domainHash}`);

    // Get style from query parameters
    const style = (event.queryStringParameters?.style || 'default') as BadgeStyle;

    // Query DynamoDB for latest scan with this domainHash
    // We need a GSI: domain-timestamp-index
    // For now, we'll do a scan (inefficient, but works for MVP)
    // TODO: Create proper GSI in init-db.js
    
    const queryResponse = await dynamodb.send(
      new QueryCommand({
        TableName: SCANS_TABLE,
        IndexName: 'domainHash-timestamp-index', // GSI to be created
        KeyConditionExpression: 'domainHash = :hash',
        ExpressionAttributeValues: {
          ':hash': { S: domainHash },
        },
        ScanIndexForward: false, // DESC order by timestamp
        Limit: 1, // Only get the latest scan
      })
    );

    if (!queryResponse.Items || queryResponse.Items.length === 0) {
      // Domain not found, return a "Not Scanned" badge
      return generateNotScannedBadge(corsHeaders, style);
    }

    const scanRecord: any = unmarshall(queryResponse.Items[0]);
    const score = scanRecord.score || 0;
    const domain = scanRecord.url ? new URL(scanRecord.url).hostname : undefined;

    // Generate SVG badge
    const badgeService = new BadgeService();
    const svg = badgeService.generateSVG(score, domain, style);

    console.log(`[badgeHandler] Badge generated successfully for score: ${score}`);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Score': String(score), // Debug header
      },
      body: svg,
    };

  } catch (error: any) {
    console.error('[badgeHandler] Error:', error);

    // Return error badge instead of JSON error
    return generateErrorBadge('Error loading score', corsHeaders);
  }
}

/**
 * Generate a "Not Scanned" badge
 */
function generateNotScannedBadge(
  corsHeaders: Record<string, string>,
  style: BadgeStyle = 'default'
): APIGatewayProxyResult {
  // Simple SVG badge indicating domain hasn't been scanned
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img" aria-label="Not scanned">
  <title>Not scanned yet</title>
  <rect width="90" height="20" fill="#555"/>
  <rect x="90" width="90" height="20" fill="#999"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="10">
    <text x="45" y="14">accessibility</text>
    <text x="135" y="14">not scanned</text>
  </g>
</svg>
  `.trim();

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes only
    },
    body: svg,
  };
}

/**
 * Generate an error badge
 */
function generateErrorBadge(
  message: string,
  corsHeaders: Record<string, string>
): APIGatewayProxyResult {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img" aria-label="Error">
  <title>Error: ${message}</title>
  <rect width="180" height="20" fill="#ef4444"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,sans-serif" font-size="10">
    <text x="90" y="14">Error: ${message}</text>
  </g>
</svg>
  `.trim();

  return {
    statusCode: 200, // Return 200 so browser displays the error badge
    headers: {
      ...corsHeaders,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache',
    },
    body: svg,
  };
}
