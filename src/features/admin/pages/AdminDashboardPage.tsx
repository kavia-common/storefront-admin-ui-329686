import { useEffect, useState } from "react";
import { shopizerApi } from "../../../api";

type HealthResult = {
  ok: boolean;
  status: number;
  bodyText: string;
  error?: string;
  url?: string;
};

// PUBLIC_INTERFACE
export function AdminDashboardPage() {
  /** Admin dashboard with backend diagnostics (health check via the shared API client + existing /api proxy). */
  const [result, setResult] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setResult(null);

    // Boundary layer: convert API result to UI state in one place.
    const r = await shopizerApi.system.getActuatorHealth();
    setResult({
      ok: r.ok,
      status: r.status,
      bodyText: r.bodyText,
      error: r.error,
      url: r.url,
    });

    setLoading(false);
  };

  useEffect(() => {
    // Auto-run once to quickly verify proxy/backend connectivity.
    void fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Admin Dashboard</h1>
          <p className="pageSubtitle">Diagnostics view for verifying gateway connectivity from the SPA.</p>
        </div>
        <span className="badge">
          <span className="badgeDot" aria-hidden="true" />
          Admin
        </span>
      </div>

      <div className="grid" aria-label="Admin dashboard cards">
        <div className="gridCard gridCol6">
          <h2 style={{ marginTop: 0 }}>Quick links</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Helpful endpoints for debugging the gateway and API routing.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            <li>
              <a href="/api/openapi.json" target="_blank" rel="noreferrer">
                OpenAPI (gateway): /api/openapi.json
              </a>
            </li>
            <li>
              <a href="/api/actuator/health" target="_blank" rel="noreferrer">
                Actuator health: /api/actuator/health
              </a>
            </li>
          </ul>
        </div>

        <div className="gridCard gridCol6">
          <div className="pageTitleRow">
            <h2 style={{ margin: 0 }}>Health check</h2>
            <button className="btn btnGhost" onClick={fetchHealth} disabled={loading}>
              {loading ? "Checking…" : "Re-check"}
            </button>
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            {!result && !loading && <p className="muted">No result yet.</p>}

            {result && (
              <>
                <div className={`alert ${result.ok ? "alertSuccess" : "alertWarning"}`} role="status" style={{ marginTop: 0 }}>
                  <div className="alertTitle">{result.ok ? "Backend reachable" : "Backend not healthy / unreachable"}</div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    HTTP: <strong>{result.status || "(request failed)"}</strong> · OK: <strong>{String(result.ok)}</strong>
                    {result.url ? (
                      <>
                        {" "}
                        · URL: <code>{result.url}</code>
                      </>
                    ) : null}
                  </p>
                  {result.error ? (
                    <p style={{ marginTop: "0.5rem", marginBottom: 0, color: "crimson", whiteSpace: "pre-wrap" }}>
                      <strong>Error:</strong> {result.error}
                    </p>
                  ) : null}
                </div>

                <h3 style={{ marginTop: "1rem" }}>Body</h3>
                <pre className="codeBlock" style={{ margin: 0, overflowX: "auto" }}>
                  {result.bodyText || "(empty)"}
                </pre>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
