import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { CopilotRuntime, createCopilotEndpoint } from '@copilotkit/runtime/v2';
import { LangGraphAgent } from '@copilotkit/runtime/langgraph';

const agent = new LangGraphAgent({
  deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL ?? 'http://localhost:8133',
  graphId: process.env.LANGGRAPH_GRAPH_ID ?? 'default',
  langsmithApiKey: process.env.LANGSMITH_API_KEY ?? '',
  assistantConfig: {
    recursion_limit: Number(process.env.LANGGRAPH_RECURSION_LIMIT ?? 80),
  },
});

const app = createCopilotEndpoint({
  basePath: '/api/copilotkit',
  runtime: new CopilotRuntime({
    agents: { default: agent },
    identifyUser: () => ({
      id: process.env.COPILOT_USER_ID ?? 'local-user',
      name: process.env.COPILOT_USER_NAME ?? 'CaudalFlow User',
    }),
    licenseToken: process.env.COPILOTKIT_LICENSE_TOKEN,
    openGenerativeUI: true,
    a2ui: { injectA2UITool: true },
  }),
});

app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

const port = Number(process.env.PORT ?? 4000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`CopilotKit BFF ready at http://localhost:${port}/api/copilotkit`);
});
