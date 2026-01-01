const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';

const ddb = new DynamoDBClient({ region: REGION });

const TABLES = [
  {
    name: 'A11yFlow_Customers',
    params: {
      TableName: 'A11yFlow_Customers',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'customerId', type: 'S' },
        { AttributeName: 'stripeCustomerId', type: 'S' },
        { AttributeName: 'subscriptionStatus', type: 'S' },
        { AttributeName: 'nextScanDate', type: 'S' },
      ].map((a) => ({ AttributeName: a.AttributeName, AttributeType: a.type })),
      KeySchema: [
        { AttributeName: 'customerId', KeyType: 'HASH' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'stripeCustomerId-index',
          KeySchema: [{ AttributeName: 'stripeCustomerId', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'active-by-nextScanDate',
          KeySchema: [
            { AttributeName: 'subscriptionStatus', KeyType: 'HASH' },
            { AttributeName: 'nextScanDate', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
  },
  {
    name: 'A11yFlow_History',
    params: {
      TableName: 'A11yFlow_History',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'customerId', type: 'S' },
        { AttributeName: 'scanTimestamp', type: 'S' },
      ].map((a) => ({ AttributeName: a.AttributeName, AttributeType: a.type })),
      KeySchema: [
        { AttributeName: 'customerId', KeyType: 'HASH' },
        { AttributeName: 'scanTimestamp', KeyType: 'RANGE' },
      ],
    },
  },
];

async function tableExists(tableName) {
  try {
    await ddb.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function waitForActive(tableName) {
  for (let i = 0; i < 30; i++) {
    const resp = await ddb.send(new DescribeTableCommand({ TableName: tableName }));
    const status = resp.Table?.TableStatus;
    if (status === 'ACTIVE') return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Table ${tableName} did not become ACTIVE in time`);
}

async function ensureTable(def) {
  const exists = await tableExists(def.name);
  if (exists) {
    console.log(`✅ Table ${def.name} already exists`);
    return;
  }

  console.log(`📦 Creating table ${def.name} in region ${REGION}...`);
  await ddb.send(new CreateTableCommand(def.params));
  await waitForActive(def.name);
  console.log(`✅ Table ${def.name} is ACTIVE`);
}

(async () => {
  try {
    console.log(`🚀 Initializing DynamoDB tables in region ${REGION}...`);
    for (const t of TABLES) {
      await ensureTable(t);
    }
    console.log('🎉 init-db finished successfully');
  } catch (err) {
    console.error('❌ init-db failed:', err.message || err);
    process.exit(1);
  }
})();
