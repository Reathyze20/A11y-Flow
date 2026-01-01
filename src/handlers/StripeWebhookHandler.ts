import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const CUSTOMERS_TABLE = process.env.CUSTOMERS_TABLE_NAME || 'A11yFlow_Customers';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE';

interface StripeCheckoutSession {
  id: string;
  customer: string;
  customer_email?: string;
  customer_details?: {
    email?: string;
  };
  metadata?: {
    targetUrl?: string;
    scanFrequencyDays?: string;
    [key: string]: string | undefined;
  };
  subscription?: string;
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

function addDaysToNow(days: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return now.toISOString();
}

export const stripeWebhookHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing body' }),
    };
  }

  let payload: StripeWebhookEvent;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const { type } = payload;

  if (type !== 'checkout.session.completed') {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ignored', type }),
    };
  }

  const session = payload.data.object as StripeCheckoutSession;

  const stripeCustomerId = session.customer;
  const email =
    session.customer_details?.email || session.customer_email || null;
  const targetUrl = session.metadata?.targetUrl || null;
  const scanFrequencyDays =
    session.metadata?.scanFrequencyDays != null
      ? Number(session.metadata.scanFrequencyDays)
      : 7;

  if (!stripeCustomerId || !email || !targetUrl) {
    console.warn('Stripe webhook missing required fields', {
      stripeCustomerId,
      email,
      targetUrl,
    });
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Missing stripeCustomerId, email or targetUrl in session',
      }),
    };
  }

  const nowIso = new Date().toISOString();
  const nextScanDate = addDaysToNow(scanFrequencyDays);
  const subscriptionStatus: SubscriptionStatus = 'ACTIVE';

  const customerId = stripeCustomerId; // jednoduché mapování

  try {
    await docClient.send(
      new PutCommand({
        TableName: CUSTOMERS_TABLE,
        Item: {
          customerId,
          email,
          targetUrl,
          stripeCustomerId,
          subscriptionStatus,
          nextScanDate,
          scanFrequencyDays,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ConditionExpression: 'attribute_not_exists(customerId)',
      })
    );
    console.log('New customer created from Stripe session', { customerId });
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log('Customer already exists, updating', { customerId });
      await docClient.send(
        new UpdateCommand({
          TableName: CUSTOMERS_TABLE,
          Key: { customerId },
          UpdateExpression:
            'SET email = :email, targetUrl = :targetUrl, stripeCustomerId = :stripeCustomerId, subscriptionStatus = :status, nextScanDate = :nextScanDate, scanFrequencyDays = :freq, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':email': email,
            ':targetUrl': targetUrl,
            ':stripeCustomerId': stripeCustomerId,
            ':status': subscriptionStatus,
            ':nextScanDate': nextScanDate,
            ':freq': scanFrequencyDays,
            ':updatedAt': nowIso,
          },
        })
      );
    } else {
      console.error('DynamoDB error in StripeWebhookHandler', err);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal error writing to DynamoDB' }),
      };
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok', customerId }),
  };
};
