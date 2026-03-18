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
      <h1>Admin Dashboard</h1>
      <p className="muted">
        Diagnostics view for verifying gateway connectivity from the SPA.
      </p>

      <div className="card">
        <p>
          <strong>Links</strong>
        </p>
        <ul>
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

      <div className="card">
        <button onClick={fetchHealth} disabled={loading}>
          {loading ? "Checking..." : "Re-check health"}
        </button>

        <div style={{ marginTop: "1rem" }}>
          {!result && !loading && <p>No result yet.</p>}
          {result && (
            <>
              <p>
                <strong>HTTP Status:</strong> {result.status || "(request failed)"}
              </p>
              <p>
                <strong>OK:</strong> {String(result.ok)}
              </p>
              {result.url && (
                <p className="muted" style={{ marginTop: 0 }}>
                  <strong>URL:</strong> {result.url}
                </p>
              )}
              {result.error && (
                <p style={{ color: "crimson" }}>
                  <strong>Error:</strong> {result.error}
                </p>
              )}
              <p>
                <strong>Body:</strong>
              </p>
              <pre style={{ overflowX: "auto", margin: 0 }}>{result.bodyText || "(empty)"}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
