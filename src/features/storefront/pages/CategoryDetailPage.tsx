import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { shopizerApi } from "../../../api";
import type { CategoryByIdResult, CategoryNode } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

function getCategoryDisplayName(category: CategoryNode): string {
  return (
    category.description?.name ??
    category.descriptions?.[0]?.name ??
    category.code ??
    (typeof category.id === "number" || typeof category.id === "string" ? `Category ${category.id}` : "Untitled category")
  );
}

// PUBLIC_INTERFACE
export function CategoryDetailPage() {
  /**
   * Storefront category-by-id page.
   *
   * End-to-end integration contract:
   * - Uses shopizerApi.catalog.getCategoryById (non-stubbed call path).
   * - Reads categoryId from the router param.
   * - Never throws on network/API errors; renders debuggable UI states.
   */
  const { categoryId } = useParams<{ categoryId: string }>();
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CategoryByIdResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!categoryId) {
        setResult({
          ok: false,
          status: 0,
          bodyText: "",
          category: undefined,
          error: "Missing categoryId route param.",
        });
        return;
      }

      setLoading(true);
      const r = await shopizerApi.catalog.getCategoryById({ categoryId, signal: controller.signal });
      setResult(r);
      setLoading(false);
    };

    void load();
    return () => controller.abort();
  }, [categoryId]);

  return (
    <div>
      <div className="pageTitleRow">
        <h1>Category</h1>
        <span className="badge">Catalog</span>
      </div>

      <p className="pageSubtitle">
        {showDeveloperDetails ? (
          <>
            Loaded via <code>/api/__preview/catalog/stores/&lt;storeId&gt;/categories/&lt;categoryId&gt;</code>
          </>
        ) : (
          <>Category details.</>
        )}
      </p>

      <div className="toolbar">
        <Link className="buttonSecondary" to="/categories">
          ← Back to categories
        </Link>
      </div>

      {loading && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Loading category…
          </p>
        </div>
      )}

      {!loading && result && !result.ok && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Unable to load category</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {result.status ? (
              <>
                HTTP <strong>{result.status}</strong>
              </>
            ) : (
              "Request failed"
            )}
            {showDeveloperDetails && result.url ? (
              <>
                {" "}
                · URL: <code>{result.url}</code>
              </>
            ) : null}
          </p>

          <p style={{ marginBottom: 0, color: "crimson", whiteSpace: "pre-wrap" }}>{result.error ?? "Unknown error"}</p>

          {showDeveloperDetails && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary className="muted">Diagnostics (response body)</summary>
              <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                {result.bodyText ? result.bodyText.slice(0, 4000) : "(empty body)"}
              </pre>
            </details>
          )}
        </div>
      )}

      {!loading && result?.ok && !result.category && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Not found</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            The backend responded successfully, but no category payload was returned.
          </p>
        </div>
      )}

      {!loading && result?.ok && result.category && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{getCategoryDisplayName(result.category)}</h2>

          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
            <dt className="muted">ID</dt>
            <dd style={{ margin: 0 }}>
              <code>{String(result.category.id ?? "")}</code>
            </dd>

            {result.category.code ? (
              <>
                <dt className="muted">Code</dt>
                <dd style={{ margin: 0 }}>{result.category.code}</dd>
              </>
            ) : null}

            {typeof result.category.visible === "boolean" ? (
              <>
                <dt className="muted">Visible</dt>
                <dd style={{ margin: 0 }}>{result.category.visible ? "Yes" : "No"}</dd>
              </>
            ) : null}

            {typeof result.category.sortOrder === "number" ? (
              <>
                <dt className="muted">Sort order</dt>
                <dd style={{ margin: 0 }}>{result.category.sortOrder}</dd>
              </>
            ) : null}
          </dl>

          {showDeveloperDetails && (
            <details style={{ marginTop: "1rem" }}>
              <summary className="muted">Raw category JSON (normalized)</summary>
              <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                {JSON.stringify(result.category, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
