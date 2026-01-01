const {
  ApiGatewayV2Client,
  GetApisCommand,
  CreateApiCommand,
  GetIntegrationsCommand,
  CreateIntegrationCommand,
  GetRoutesCommand,
  CreateRouteCommand,
  GetStagesCommand,
  CreateStageCommand,
  UpdateApiCommand,
  UpdateRouteCommand,
  UpdateStageCommand,
} = require('@aws-sdk/client-apigatewayv2');
const {
  LambdaClient,
  GetFunctionCommand,
} = require('@aws-sdk/client-lambda');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1';
const API_NAME = process.env.A11YFLOW_API_NAME || 'A11yFlow-API';

const ROUTES = [
  {
    method: 'POST',
    path: '/webhook/stripe',
    lambdaName: 'A11yFlow-StripeWebhook',
  },
  {
    method: 'GET',
    path: '/history/{customerId}',
    lambdaName: 'A11yFlow-HistoryApi',
  },
  {
    method: 'POST',
    path: '/scan',
    lambdaName: 'A11yFlow-Scanner',
  },
];

const CORS_CONFIG = {
  AllowOrigins: ['*'],
  AllowMethods: ['GET', 'POST', 'OPTIONS'],
  AllowHeaders: ['*'],
};

const apigw = new ApiGatewayV2Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function ensureHttpApi() {
  console.log(`\n🌐 Ensuring HTTP API ${API_NAME} exists...`);

  const list = await apigw.send(new GetApisCommand({ MaxResults: '100' }));
  const existing = (list.Items || []).find((api) => api.Name === API_NAME);

  if (existing) {
    console.log(`✅ API already exists with id ${existing.ApiId}`);

    // Ensure CORS is configured as desired
    await apigw.send(
      new UpdateApiCommand({
        ApiId: existing.ApiId,
        CorsConfiguration: CORS_CONFIG,
      }),
    );

    return existing.ApiId;
  }

  const created = await apigw.send(
    new CreateApiCommand({
      Name: API_NAME,
      ProtocolType: 'HTTP',
      CorsConfiguration: CORS_CONFIG,
    }),
  );

  console.log(`✅ Created HTTP API with id ${created.ApiId}`);
  return created.ApiId;
}

async function ensureStage(apiId) {
  console.log('\n🎯 Ensuring $default stage with auto-deploy...');
  const stagesResp = await apigw.send(new GetStagesCommand({ ApiId: apiId }));
  const existing = (stagesResp.Items || []).find((st) => st.StageName === '$default');

  if (existing) {
    if (!existing.AutoDeploy) {
      await apigw.send(
        new UpdateStageCommand({
          ApiId: apiId,
          StageName: '$default',
          AutoDeploy: true,
        }),
      );
      console.log('✅ Updated existing $default stage to AutoDeploy=true');
    } else {
      console.log('✅ $default stage already exists with AutoDeploy=true');
    }
    return;
  }

  await apigw.send(
    new CreateStageCommand({
      ApiId: apiId,
      StageName: '$default',
      AutoDeploy: true,
    }),
  );
  console.log('✅ Created $default stage with AutoDeploy=true');
}

async function getLambdaArn(functionName) {
  const resp = await lambda.send(
    new GetFunctionCommand({ FunctionName: functionName }),
  );
  return resp.Configuration.FunctionArn;
}

async function ensureIntegration(apiId, lambdaName) {
  const lambdaArn = await getLambdaArn(lambdaName);

  const integrationsResp = await apigw.send(
    new GetIntegrationsCommand({ ApiId: apiId }),
  );
  const existing = (integrationsResp.Items || []).find(
    (i) => i.IntegrationUri === lambdaArn,
  );

  if (existing) {
    console.log(
      `✅ Reusing existing integration ${existing.IntegrationId} for ${lambdaName}`,
    );
    return existing.IntegrationId;
  }

  const created = await apigw.send(
    new CreateIntegrationCommand({
      ApiId: apiId,
      IntegrationType: 'AWS_PROXY',
      IntegrationUri: lambdaArn,
      PayloadFormatVersion: '2.0',
    }),
  );

  console.log(
    `✅ Created new integration ${created.IntegrationId} for ${lambdaName}`,
  );
  return created.IntegrationId;
}

async function ensureRoute(apiId, route) {
  const routeKey = `${route.method} ${route.path}`;
  console.log(`\n🛣️  Ensuring route ${routeKey}...`);

  const integrationId = await ensureIntegration(apiId, route.lambdaName);

  const routesResp = await apigw.send(
    new GetRoutesCommand({ ApiId: apiId }),
  );

  const existing = (routesResp.Items || []).find(
    (r) => r.RouteKey === routeKey,
  );

  if (existing) {
    if (existing.Target !== `integrations/${integrationId}`) {
      await apigw.send(
        new UpdateRouteCommand({
          ApiId: apiId,
          RouteId: existing.RouteId,
          Target: `integrations/${integrationId}`,
        }),
      );
      console.log('✅ Updated existing route to new integration');
    } else {
      console.log('✅ Route already exists with correct integration');
    }
    return;
  }

  await apigw.send(
    new CreateRouteCommand({
      ApiId: apiId,
      RouteKey: routeKey,
      Target: `integrations/${integrationId}`,
    }),
  );

  console.log('✅ Created new route');
}

(async () => {
  try {
    console.log(`🚀 init-api starting in region ${REGION}`);

    const apiId = await ensureHttpApi();

    for (const route of ROUTES) {
      await ensureRoute(apiId, route);
    }

    await ensureStage(apiId);

    const invokeUrl = `https://${apiId}.execute-api.${REGION}.amazonaws.com`;
    console.log(`\n🌍 HTTP API is ready.`);
    console.log(`   Invoke URL: ${invokeUrl}`);
    console.log('   Routes:');
    for (const route of ROUTES) {
      console.log(`   - ${route.method} ${route.path}`);
    }

    console.log('\n✅ init-api finished successfully');
  } catch (err) {
    console.error('❌ init-api failed:', err.message || err);
    process.exit(1);
  }
})();
