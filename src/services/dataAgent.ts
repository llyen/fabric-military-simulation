/**
 * Client for the Fabric Data Agent, consumed through a thin server-side proxy.
 *
 * The browser never talks to Fabric's Data Agent endpoint directly: that call
 * needs an AAD token for the Fabric service (which a static SPA can't safely
 * mint) and is subject to CORS. Instead we POST the natural-language question to
 * our own proxy (see `proxy/data-agent/`), which authenticates with a service
 * principal, forwards the question to the published Data Agent, and returns the
 * answer (and, optionally, the SQL the agent generated).
 *
 * Feature flag: set `VITE_DATA_AGENT_URL` (in `.env`) to the proxy URL. When it
 * is empty the feature is considered "not configured" and every call is a no-op
 * that returns a friendly hint — so the build/app keep working without it.
 */

export interface DataAgentAnswer {
  /** Natural-language answer from the agent (empty on error). */
  answer: string;
  /** The SQL the agent ran, when the proxy returns it (for transparency). */
  sql?: string;
  /** Set when the request failed or the feature is not configured. */
  error?: string;
}

const PROXY_URL = (import.meta.env.VITE_DATA_AGENT_URL as string | undefined)?.trim() ?? '';
const REQUEST_TIMEOUT_MS = 45_000;

/** True when a proxy URL is configured and the "Ask AI" panel should be active. */
export function isDataAgentEnabled(): boolean {
  return PROXY_URL.length > 0;
}

/**
 * Ask the Data Agent a question. Never throws — failures (not configured,
 * network, proxy error) are returned as `{ error }` so the UI can render them.
 */
export async function askDataAgent(question: string): Promise<DataAgentAnswer> {
  const q = question.trim();
  if (!q) return { answer: '', error: 'Wpisz pytanie.' };
  if (!isDataAgentEnabled()) {
    return {
      answer: '',
      error: 'Data Agent nie jest skonfigurowany — ustaw VITE_DATA_AGENT_URL.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { answer: '', error: `Proxy zwrócił ${res.status}. ${detail}`.trim() };
    }
    const data = (await res.json()) as Partial<DataAgentAnswer>;
    return {
      answer: typeof data.answer === 'string' ? data.answer : '',
      sql: typeof data.sql === 'string' ? data.sql : undefined,
      error: typeof data.error === 'string' ? data.error : undefined,
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      answer: '',
      error: aborted ? 'Przekroczono czas oczekiwania na odpowiedź.' : 'Nie udało się połączyć z Data Agentem.',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** A few domain questions to seed the UI and demo the agent. */
export const SAMPLE_QUESTIONS: string[] = [
  'Ile pojazdów ma paliwo poniżej 40%?',
  'Pokaż żołnierzy w stanie krytycznym według sektora.',
  'Jaki jest najczęstszy typ kontaktu radarowego?',
  'Wypisz ostatnie zdarzenia MEDEVAC.',
];
