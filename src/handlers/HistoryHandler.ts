import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const HISTORY_TABLE = process.env.HISTORY_TABLE_NAME || 'A11yFlow_History';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const historyHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const customerId = event.pathParameters?.customerId;
  if (!customerId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing path parameter customerId' }),
    };
  }

  const limitParam = event.queryStringParameters?.limit;
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 1), 100) : 50;

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: HISTORY_TABLE,
        KeyConditionExpression: 'customerId = :cid',
        ExpressionAttributeValues: {
          ':cid': customerId,
        },
        Limit: limit,
        ScanIndexForward: false, // nejnovější záznamy jako první
      })
    );

    const items = (result.Items || []).map((it) => ({
      scanId: it.scanId,
      scanTimestamp: it.scanTimestamp,
      rootUrl: it.rootUrl,
      score: it.score,
      totalIssues: it.totalIssues,
      criticalIssues: it.criticalIssues,
      mode: it.mode,
      device: it.device,
      reportJsonUrl: it.reportJsonUrl,
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        customerId,
        items,
      }),
    };
  } catch (err) {
    console.error('Error querying history for customer', customerId, err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error querying history' }),
    };
  }
};
