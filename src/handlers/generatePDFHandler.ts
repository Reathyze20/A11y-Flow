import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { PDFGenerator, PDFGenerationOptions } from '../core/PDFGenerator.js';
import { AuditReport } from '../core/types.js';
import * as crypto from 'crypto';

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const SCANS_TABLE = process.env.SCANS_TABLE || 'a11yflow-scans';
const PDF_BUCKET = process.env.PDF_BUCKET || 'a11yflow-pdf-reports';

/**
 * Lambda Handler for PDF Generation
 * 
 * Endpoint: POST /report/{reportId}/pdf
 * 
 * Access Control:
 * - Free tier: 402 Payment Required
 * - Pro plan: Unlimited PDF generation
 * - One-time audit: 1 PDF included
 * 
 * Response:
 * - 200: { pdfUrl: string }
 * - 402: Payment Required
 * - 404: Report not found
 * - 500: Server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
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
    // Extract reportId from path parameters
    const reportId = event.pathParameters?.reportId;

    if (!reportId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing reportId' }),
      };
    }

    console.log(`[generatePDFHandler] Generating PDF for report: ${reportId}`);

    // Get report from DynamoDB
    const getItemResponse = await dynamodb.send(
      new GetItemCommand({
        TableName: SCANS_TABLE,
        Key: {
          reportId: { S: reportId },
        },
      })
    );

    if (!getItemResponse.Item) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Report not found' }),
      };
    }

    const scanRecord: any = unmarshall(getItemResponse.Item);

    // TODO: Check user plan and permissions
    // For now, we'll allow PDF generation for all reports
    // In production, you would check:
    // - scanRecord.userPlan === 'pro' || scanRecord.userPlan === 'one-time'
    // - scanRecord.pdfCredits > 0 (for one-time audits)
    
    // Example access control (commented out for development):
    /*
    if (scanRecord.userPlan === 'free') {
      return {
        statusCode: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Payment Required',
          message: 'PDF export is available only for Pro and One-Time Audit plans',
          upgradeUrl: 'https://a11yflow.com/pricing'
        }),
      };
    }
    */

    // Parse report data
    const reportData: AuditReport = JSON.parse(scanRecord.reportData || '{}');

    // Parse PDF options from request body
    let options: PDFGenerationOptions = {};
    if (event.body) {
      try {
        options = JSON.parse(event.body);
      } catch (e) {
        console.warn('[generatePDFHandler] Invalid JSON in request body, using defaults');
      }
    }

    // Generate PDF
    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(reportData, options);
    await pdfGenerator.close();

    // Upload PDF to S3
    const pdfKey = `reports/${reportId}/report-${Date.now()}.pdf`;
    await s3.send(
      new PutObjectCommand({
        Bucket: PDF_BUCKET,
        Key: pdfKey,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: `attachment; filename="accessibility-report-${reportId}.pdf"`,
        // PDF is valid for 30 days for free tier, forever for paid
        // This can be controlled via S3 Lifecycle policies
      })
    );

    // Generate signed URL (valid for 7 days)
    const pdfUrl = `https://${PDF_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${pdfKey}`;

    // TODO: Update scan record in DynamoDB with pdfUrl and pdfGeneratedAt
    // TODO: Decrement pdfCredits if one-time audit

    console.log(`[generatePDFHandler] PDF generated successfully: ${pdfUrl}`);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        pdfUrl,
        reportId,
      }),
    };

  } catch (error: any) {
    console.error('[generatePDFHandler] Error:', error);

    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message || 'Failed to generate PDF',
      }),
    };
  }
}
