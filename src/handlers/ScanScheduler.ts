import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Crawler } from '../core/Crawler';
import { ScanDevice } from '../core/WebScanner';

const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE_NAME || 'A11yFlow_Customers';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface CustomerItem {
  customerId: string;
  targetUrl: string;
  subscriptionStatus: string;
  nextScanDate: string;
  scanFrequencyDays?: number;
}

function addDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export const scanSchedulerHandler = async (
  event: EventBridgeEvent<string, unknown>
): Promise<void> => {
  const nowIso = new Date().toISOString();
  const maxPages = Number(process.env.SCHEDULER_MAX_PAGES || '10');
  const deviceEnv = (process.env.SCHEDULER_DEVICE || 'desktop') as string;
  const device: ScanDevice = deviceEnv === 'mobile' ? 'mobile' : 'desktop';

  console.log('ScanScheduler triggered at', nowIso, 'eventId', event.id);

  const dueCustomers: CustomerItem[] = [];

  // Vybereme zákazníky, kteří mají aktivní předplatné a jsou na řadě ke skenu.
  const queryResp = await docClient.send(
    new QueryCommand({
      TableName: CUSTOMERS_TABLE,
      IndexName: 'active-by-nextScanDate',
      KeyConditionExpression:
        'subscriptionStatus = :status AND nextScanDate <= :now',
      ExpressionAttributeValues: {
        ':status': 'ACTIVE',
        ':now': nowIso,
      },
    })
  );

  (queryResp.Items || []).forEach((item) => {
    if (!item.customerId || !item.targetUrl) return;
    dueCustomers.push({
      customerId: String(item.customerId),
      targetUrl: String(item.targetUrl),
      subscriptionStatus: String(item.subscriptionStatus),
      nextScanDate: String(item.nextScanDate),
      scanFrequencyDays: item.scanFrequencyDays
        ? Number(item.scanFrequencyDays)
        : undefined,
    });
  });

  console.log('Customers to scan:', dueCustomers.length);

  for (const customer of dueCustomers) {
    try {
      console.log('Starting crawl for customer', customer.customerId, 'url', customer.targetUrl);
      const crawler = new Crawler(maxPages, { device });
      await crawler.crawlAndPersist(customer.customerId, customer.targetUrl);

      const freq = customer.scanFrequencyDays ?? 7;
      const nextScanDate = addDays(nowIso, freq);

      await docClient.send(
        new UpdateCommand({
          TableName: CUSTOMERS_TABLE,
          Key: { customerId: customer.customerId },
          UpdateExpression: 'SET nextScanDate = :next, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':next': nextScanDate,
            ':updatedAt': new Date().toISOString(),
          },
        })
      );
    } catch (err) {
      console.error('Error during scheduled scan for customer', customer.customerId, err);
    }
  }

  console.log('ScanScheduler finished.');
};
