import { app } from '@azure/functions';
import { handleAsk } from '../../index.mjs';

/**
 * Azure Functions v4 HTTP trigger that exposes the Data Agent proxy at
 * POST /api/ask. CORS is locked to ALLOWED_ORIGIN; auth is anonymous so the
 * signed-in SPA can call it from the browser (no function key in client code).
 */
function cors() {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

app.http('ask', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ask',
  handler: async (request, context) => {
    if (request.method === 'OPTIONS') {
      return { status: 204, headers: cors() };
    }
    try {
      const { question } = await request.json();
      if (!question || typeof question !== 'string') {
        return { status: 400, headers: cors(), jsonBody: { error: 'missing "question"' } };
      }
      const result = await handleAsk(question);
      return { status: 200, headers: cors(), jsonBody: result };
    } catch (err) {
      context.error('[data-agent-proxy]', err);
      return {
        status: 502,
        headers: cors(),
        jsonBody: { error: 'data agent request failed', detail: String(err?.message ?? err) },
      };
    }
  },
});
