import { useEffect, useState } from 'react';
import {
  askDataAgent,
  isDataAgentEnabled,
  SAMPLE_QUESTIONS,
  type DataAgentAnswer,
} from '@/services/dataAgent';

/**
 * HUD panel that lets the operator ask the Fabric Data Agent natural-language
 * questions about the live battlefield data. Read-only: it never changes the
 * simulation. Inactive (with a hint) until `VITE_DATA_AGENT_URL` is configured.
 */
export function AskAI() {
  const enabled = isDataAgentEnabled();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<DataAgentAnswer | null>(null);
  const [showSql, setShowSql] = useState(false);

  // Tick an elapsed-seconds counter while a question is in flight so the
  // operator can see the agent is working (runs typically take ~10–20 s).
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [loading]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || loading) return;
    setQuestion(text);
    setLoading(true);
    setResult(null);
    const res = await askDataAgent(text);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="hud ask-ai">
      <button className="ask-ai-head" onClick={() => setOpen((o) => !o)}>
        <span className="hud-section" style={{ margin: 0 }}>ASK AI</span>
        <span className="ask-ai-toggle">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="ask-ai-body">
          {!enabled && (
            <div className="ask-ai-hint">
              Data Agent nie jest skonfigurowany. Ustaw <code>VITE_DATA_AGENT_URL</code> i
              wdróż proxy (zobacz <code>proxy/data-agent/</code>).
            </div>
          )}

          <div className="ask-ai-chips">
            {SAMPLE_QUESTIONS.map((s) => (
              <button
                key={s}
                className="ask-ai-chip"
                disabled={!enabled || loading}
                onClick={() => ask(s)}
                title={s}
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="ask-ai-form"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <input
              className="ask-ai-input"
              value={question}
              placeholder="Zapytaj o dane bitwy…"
              disabled={!enabled || loading}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button className="ask-ai-send" disabled={!enabled || loading} type="submit">
              {loading ? '…' : 'Zapytaj'}
            </button>
          </form>

          {loading && (
            <div className="ask-ai-thinking">
              <span className="ask-ai-spinner" />
              <span>
                Agent analizuje dane… {elapsed}s
                {elapsed >= 8 && ' (zapytania zwykle trwają 10–20 s)'}
              </span>
            </div>
          )}

          {result && (
            <div className="ask-ai-result">
              {result.error ? (
                <div className="ask-ai-error">{result.error}</div>
              ) : (
                <>
                  <div className="ask-ai-answer">{result.answer || '(brak odpowiedzi)'}</div>
                  {result.sql && (
                    <div className="ask-ai-sqlwrap">
                      <button className="ask-ai-sqltoggle" onClick={() => setShowSql((v) => !v)}>
                        {showSql ? 'Ukryj SQL' : 'Pokaż SQL'}
                      </button>
                      {showSql && <pre className="ask-ai-sql">{result.sql}</pre>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
