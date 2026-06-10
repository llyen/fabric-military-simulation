# IRONSHIELD — Data Agent proxy

A thin, **read-only** server that lets the browser app ask a published
**Microsoft Fabric Data Agent** natural-language questions about the live
battlefield data (Vehicles, Soldiers, Drones, RadarTracks, SimEvents, …).

The browser never calls Fabric directly — that needs an AAD token for the Fabric
service (which a static SPA can't safely mint) and is blocked by CORS. This proxy
authenticates with a **service principal**, forwards the question, and returns
`{ answer, sql? }`.

```
browser  ──POST {question}──►  this proxy  ──Bearer token──►  Fabric Data Agent
   ▲                                                                │
   └───────────────  { answer, sql }  ◄────────────────────────────┘
```

## Prerequisites

1. **Publish a Data Agent** in your Fabric workspace over the Rayfin SQL database
   (tables `dbo.Vehicles`, `dbo.Soldiers`, `dbo.Drones`, `dbo.RadarTracks`,
   `dbo.WeatherCells`, `dbo.SimEvents`, `dbo.Sectors`). Add AI instructions +
   a few example question→SQL pairs for best accuracy. Copy its endpoint URL.
2. **App registration (service principal)** with permission to call the Fabric
   service / read the workspace. Note `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`.

## Configure

Set environment variables (e.g. in a local `.env`, or your host's app settings):

| Variable         | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `TENANT_ID`      | Entra tenant id (GUID)                                 |
| `CLIENT_ID`      | App registration client id                             |
| `CLIENT_SECRET`  | App registration client secret                         |
| `DATA_AGENT_URL` | Published Data Agent endpoint                          |
| `ALLOWED_ORIGIN` | App origin for CORS, e.g. `https://equal-stone-….net`  |
| `PORT`           | Local port (default `7071`)                            |

## Run locally

```bash
cd proxy/data-agent
npm install        # no deps yet — uses Node 18+ built-ins
node index.mjs
```

Then point the app at it and rebuild:

```
# in the repo root .env
VITE_DATA_AGENT_URL=http://localhost:7071/
```

```bash
npm run rayfin:up   # rebuilds the app with the flag and redeploys
```

Open the app → expand **ASK AI** in the HUD → ask a question.

## Deploy

Any Node host works. Recommended: **Azure Functions** or **Azure Container Apps**
(same tenant/region as Fabric keeps latency low).

- **Azure Functions v4:** add a trigger that calls the exported `handleAsk`:

  ```js
  import { app } from '@azure/functions';
  import { handleAsk } from '../index.mjs';

  app.http('ask', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'function',
    handler: async (req) => {
      if (req.method === 'OPTIONS') return { status: 204 };
      const { question } = await req.json();
      try {
        return { jsonBody: await handleAsk(question) };
      } catch (e) {
        return { status: 502, jsonBody: { error: String(e?.message ?? e) } };
      }
    },
  });
  ```

  Set `VITE_DATA_AGENT_URL` to `https://<func-app>.azurewebsites.net/api/ask`.

- **Container Apps / App Service:** run `node index.mjs` and expose the port;
  set `VITE_DATA_AGENT_URL` to the public URL.

## Adapting `callDataAgent`

The Data Agent endpoint contract is still evolving (preview). `callDataAgent()`
is isolated so you can match whatever your published agent expects — either a
single `POST { question }` or the OpenAI-style **threads → messages → runs →
messages** flow (steps are documented inline in `index.mjs`). Auth, CORS, and
error handling stay the same.

## Security notes

- **Read-only:** the proxy only asks questions; it cannot change the simulation
  (tempo stays driven by `SimControl`).
- Keep `CLIENT_SECRET` server-side only — never expose it to the browser.
- Lock `ALLOWED_ORIGIN` to the app's origin in production (avoid `*`).
- Consider rate-limiting and caching identical questions.
