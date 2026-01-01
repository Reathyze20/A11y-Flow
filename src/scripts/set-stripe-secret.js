const {
  LambdaClient,
  GetFunctionCommand,
  UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';
const FUNCTION_NAME = process.env.A11YFLOW_STRIPE_LAMBDA || 'A11yFlow-StripeWebhook';

(async () => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET environment variable is not set.');
      process.exit(1);
    }

    const lambda = new LambdaClient({ region: REGION });

    console.log(`🔑 Updating ${FUNCTION_NAME} environment with STRIPE_WEBHOOK_SECRET...`);

    const current = await lambda.send(
      new GetFunctionCommand({ FunctionName: FUNCTION_NAME }),
    );

    const currentEnv = (current.Configuration.Environment && current.Configuration.Environment.Variables) || {};

    const newEnv = {
      ...currentEnv,
      STRIPE_WEBHOOK_SECRET: secret,
    };

    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: FUNCTION_NAME,
        Environment: { Variables: newEnv },
      }),
    );

    console.log('✅ STRIPE_WEBHOOK_SECRET has been set on the Lambda.');
    console.log('   If this is a new value, wait for the Lambda');
    console.log('   configuration update to finish before sending events.');
  } catch (err) {
    console.error('❌ set-stripe-secret failed:', err.message || err);
    process.exit(1);
  }
})();
