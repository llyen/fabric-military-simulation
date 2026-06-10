/**
 * Thin proxy between the browser app and a published Microsoft Fabric Data Agent.
 *
 * Why a proxy?
 *   - The Data Agent endpoint needs an AAD bearer token for the Fabric service,
 *     which a static SPA cannot safely mint.
 *   - Browser → Fabric calls are also blocked by CORS.
 * This server authenticates with a service principal (client-credentials),
 * forwards the user's natural-language question to the Data Agent, and returns
 * `{ answer, sql? }` to the app. It is READ-ONLY — it never drives the sim.
 *
 * Run locally:
 *   cd proxy/data-agent && npm install && node index.mjs
 * Then point the app at it:  VITE_DATA_AGENT_URL=http://localhost:7071/
 *
 * Deploy: any Node host works (Azure Functions, Azure Container Apps, App
 * Service). For Azure Functions v4, wrap `handleAsk` in an `app.http(...)`
 * trigger; the logic below is host-agnostic.
 *
 * Required environment variables:
 *   TENANT_ID         Entra tenant id (GUID)
 *   CLIENT_ID         App registration (service principal) client id
 *   CLIENT_SECRET     App registration client secret
 *   DATA_AGENT_URL    Published Data Agent endpoint (from Fabric → Publish)
 *   ALLOWED_ORIGIN    CORS origin of the app (e.g. https://equal-stone-...net)
 *
 * NOTE: The exact request/response shape of the Data Agent endpoint is still
 * evolving (preview). `callDataAgent()` below is intentionally isolated so you
 * can adapt the body/path to whatever your published agent expects (a single
 * POST, or the OpenAI-style threads → messages → runs flow). The rest of the
 * proxy — auth, CORS, error handling — stays the same.
 */
import http from 'node:http';

const {
  TENANT_ID,
  CLIENT_ID,
  CLIENT_SECRET,
  DATA_AGENT_URL,
  ALLOWED_ORIGIN = '*',
  PORT = '7071',
} = process.env;

// Fabric service scope for client-credentials. Adjust if your tenant uses a
// different resource for the Data Agent endpoint.
const FABRIC_SCOPE = 'https://api.fabric.microsoft.com/.default';

/** Acquire an app-only access token for the Fabric service. */
async function getToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: FABRIC_SCOPE,
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  if (!res.ok) throw new Error(`token request failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

/**
 * Send the question to the Data Agent and normalise the reply.
 *
 * Replace the body/parsing here to match your published agent. The default is a
 * simple POST { question } → { answer, sql } which works with a proxy/AI-skill
 * that already wraps the threads/runs protocol. For a raw Data Agent you would:
 *   1) POST .../threads                      → threadId
 *   2) POST .../threads/{id}/messages        (role:user, content: question)
 *   3) POST .../threads/{id}/runs            → poll until completed
 *   4) GET  .../threads/{id}/messages        → newest assistant message
 */
async function callDataAgent(token, question) {
  const res = await fetch(DATA_AGENT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`data agent failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // Be liberal in what we accept from the agent.
  return {
    answer: data.answer ?? data.output ?? data.content ?? '',
    sql: data.sql ?? data.query ?? undefined,
  };
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, payload) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

/** Host-agnostic core: takes a question string, returns { answer, sql } or throws. */
export async function handleAsk(question) {
  if (!DATA_AGENT_URL || !TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('proxy not configured: set TENANT_ID, CLIENT_ID, CLIENT_SECRET, DATA_AGENT_URL');
  }
  const token = await getToken();
  return callDataAgent(token, question);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const { question } = JSON.parse(raw || '{}');
      if (!question || typeof question !== 'string') {
        return send(res, 400, { error: 'missing "question"' });
      }
      const result = await handleAsk(question);
      send(res, 200, result);
    } catch (err) {
      console.error('[data-agent-proxy]', err);
      send(res, 502, { error: 'data agent request failed', detail: String(err?.message ?? err) });
    }
  });
});

// Only start listening when run directly (not when imported by a Functions host).
if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(Number(PORT), () => {
    console.log(`[data-agent-proxy] listening on http://localhost:${PORT}  (POST /)`);
  });
}

export default server;
