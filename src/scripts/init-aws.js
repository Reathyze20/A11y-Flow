const {
  IAMClient,
  CreateRoleCommand,
  GetRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
} = require('@aws-sdk/client-iam');
const {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';

// Uprav podle bucketu, kde máš function.zip.zip
const S3_BUCKET = process.env.A11YFLOW_DEPLOY_BUCKET || 'a11y-flow-deploy';
const S3_KEY = 'function.zip.zip';

const ROLE_NAME = 'A11yFlow-LambdaRole';

const LAMBDAS = [
  {
    name: 'A11yFlow-Scanner',
    handler: 'index.handler',
    env: {
      // Tyhle proměnné už pravděpodobně máš nastavené ručně,
      // tady jsou jen jako připomínka – můžeš je doplnit nebo nechat prázdné.
      A11Y_API_KEY: process.env.A11Y_API_KEY || '',
      A11Y_SCREENSHOT_BUCKET: process.env.A11Y_SCREENSHOT_BUCKET || '',
      HISTORY_TABLE_NAME: 'A11yFlow_History',
    },
    memorySize: 2048,
    timeout: 300,
  },
  {
    name: 'A11yFlow-StripeWebhook',
    handler: 'index.stripeWebhookHandler',
    env: {
      CUSTOMERS_TABLE_NAME: 'A11yFlow_Customers',
    },
  },
  {
    name: 'A11yFlow-ScanScheduler',
    handler: 'index.scanSchedulerHandler',
    env: {
      CUSTOMERS_TABLE_NAME: 'A11yFlow_Customers',
      HISTORY_TABLE_NAME: 'A11yFlow_History',
      SCHEDULER_MAX_PAGES: '10',
      SCHEDULER_DEVICE: 'desktop',
    },
  },
  {
    name: 'A11yFlow-HistoryApi',
    handler: 'index.historyHandler',
    env: {
      HISTORY_TABLE_NAME: 'A11yFlow_History',
    },
  },
];

const iam = new IAMClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function ensureRole() {
  console.log(`🔐 Ensuring IAM role ${ROLE_NAME} exists...`);

  let roleArn;
  try {
    const existing = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
    roleArn = existing.Role.Arn;
    console.log(`✅ Role already exists: ${roleArn}`);
  } catch (err) {
    if (err.name !== 'NoSuchEntityException') {
      throw err;
    }

    console.log('📦 Creating new IAM role...');
    const assumeRolePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    };

    const createResp = await iam.send(
      new CreateRoleCommand({
        RoleName: ROLE_NAME,
        AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy),
      }),
    );
    roleArn = createResp.Role.Arn;
    console.log(`✅ Role created: ${roleArn}`);

    console.log('🔗 Attaching AWSLambdaBasicExecutionRole managed policy...');
    await iam.send(
      new AttachRolePolicyCommand({
        RoleName: ROLE_NAME,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      }),
    );

    console.log('📝 Adding inline policy for DynamoDB & S3 access...');
    const inlinePolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:Query',
            'dynamodb:Scan',
          ],
          Resource: [
            'arn:aws:dynamodb:*:*:table/A11yFlow_Customers',
            'arn:aws:dynamodb:*:*:table/A11yFlow_History',
            'arn:aws:dynamodb:*:*:table/A11yFlow_Customers/index/*',
          ],
        },
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject'],
          Resource: [`arn:aws:s3:::${S3_BUCKET}/*`],
        },
      ],
    };

    await iam.send(
      new PutRolePolicyCommand({
        RoleName: ROLE_NAME,
        PolicyName: 'A11yFlowLambdaAccess',
        PolicyDocument: JSON.stringify(inlinePolicy),
      }),
    );
  }

  return roleArn;
}

async function ensureLambdaFunction(roleArn, def) {
  console.log(`\n🧬 Ensuring Lambda ${def.name} (${def.handler})...`);

  const commonConfig = {
    Environment: { Variables: def.env || {} },
    Handler: def.handler,
    Role: roleArn,
    Runtime: 'nodejs20.x',
    Architectures: ['x86_64'],
    Timeout: def.timeout || 30,
    MemorySize: def.memorySize || 512,
  };

  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: def.name }));
    console.log('✅ Function exists, updating code & configuration...');

    try {
      await lambda.send(
        new UpdateFunctionCodeCommand({
          FunctionName: def.name,
          S3Bucket: S3_BUCKET,
          S3Key: S3_KEY,
          Publish: true,
        }),
      );

      await lambda.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: def.name,
          ...commonConfig,
        }),
      );
    } catch (updateErr) {
      if (updateErr.name === 'ResourceConflictException') {
        console.warn(
          `⚠️  Skipping update of ${def.name} – Lambda is currently updating, try again later.`,
        );
        return;
      }
      throw updateErr;
    }
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') {
      throw err;
    }

    console.log('📦 Creating new Lambda function...');
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: def.name,
        Code: {
          S3Bucket: S3_BUCKET,
          S3Key: S3_KEY,
        },
        ...commonConfig,
      }),
    );
  }

  console.log(`✅ Lambda ${def.name} is ready.`);
}

(async () => {
  try {
    console.log(`🚀 init-aws starting in region ${REGION} (bucket: ${S3_BUCKET})`);

    const roleArn = await ensureRole();

    for (const fn of LAMBDAS) {
      await ensureLambdaFunction(roleArn, fn);
    }

    console.log('\n🎉 init-aws finished successfully');
  } catch (err) {
    console.error('❌ init-aws failed:', err.message || err);
    process.exit(1);
  }
})();
