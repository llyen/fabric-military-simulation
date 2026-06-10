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

// The published Data Agent endpoint is OpenAI-Assistants compatible
// (path ends with /aiassistant/openai). These match what the Fabric
// `FabricOpenAI` SDK client sends under the hood.
const API_VERSION = '2024-05-01-preview';
const RUN_POLL_MS = 800;
const RUN_TIMEOUT_MS = 40000;

// Per-instance caches so warm invocations skip avoidable round-trips. They live
// only in process memory and rebuild themselves automatically after a restart.
let cachedToken = null; // { value, exp }  exp = epoch ms
let cachedAssistantId = null;

/** Acquire (and cache) an app-only access token for the Fabric service. */
async function getToken() {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.value;
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
  // Refresh 60s before real expiry to avoid using a token mid-flight.
  cachedToken = { value: json.access_token, exp: Date.now() + (json.expires_in - 60) * 1000 };
  return cachedToken.value;
}

/**
 * Send the question to the Data Agent and normalise the reply.
 *
 * The published endpoint speaks the OpenAI Assistants API (its path ends with
 * `/aiassistant/openai`). The full conversation flow is:
 *   1) POST {base}/assistants                 → assistantId (model is a formality)
 *   2) POST {base}/threads                     → threadId
 *   3) POST {base}/threads/{id}/messages       (role:user, content: question)
 *   4) POST {base}/threads/{id}/runs           → runId  (assistant_id)
 *   5) GET  {base}/threads/{id}/runs/{runId}   → poll until terminal status
 *   6) GET  {base}/threads/{id}/messages       → newest assistant message
 * Every request carries `?api-version=` plus the `OpenAI-Beta: assistants=v2`
 * header, exactly like the Fabric SDK's FabricOpenAI client.
 */
async function callDataAgent(token, question) {
  const base = DATA_AGENT_URL.replace(/\/+$/, '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'assistants=v2',
  };

  const fapi = async (path, method = 'GET', body) => {
    const url = `${base}${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`data agent ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  };

  // Reuse one assistant per warm instance — it is stateless across threads.
  if (!cachedAssistantId) {
    cachedAssistantId = (await fapi('/assistants', 'POST', { model: 'gpt-4o' })).id;
  }
  const thread = await fapi('/threads', 'POST', {});
  await fapi(`/threads/${thread.id}/messages`, 'POST', { role: 'user', content: question });
  let run = await fapi(`/threads/${thread.id}/runs`, 'POST', { assistant_id: cachedAssistantId });

  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (run.status === 'queued' || run.status === 'in_progress' || run.status === 'cancelling') {
    if (Date.now() > deadline) throw new Error(`data agent run timed out (last status: ${run.status})`);
    await new Promise((r) => setTimeout(r, RUN_POLL_MS));
    run = await fapi(`/threads/${thread.id}/runs/${run.id}`);
  }
  if (run.status !== 'completed') {
    const reason = run.last_error?.message ?? run.incomplete_details?.reason ?? run.status;
    throw new Error(`data agent run did not complete: ${reason}`);
  }

  const messages = await fapi(`/threads/${thread.id}/messages?order=desc&limit=10`);
  const assistantMsg = (messages.data ?? []).find((m) => m.role === 'assistant');
  const answer = (assistantMsg?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text?.value ?? '')
    .join('\n')
    .trim();

  // Surface any fenced SQL block the agent included, as a convenience.
  const sqlMatch = answer.match(/```sql\s*([\s\S]*?)```/i);

  return {
    answer: sqlMatch ? answer.replace(sqlMatch[0], '').trim() : answer,
    sql: sqlMatch ? sqlMatch[1].trim() : undefined,
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
