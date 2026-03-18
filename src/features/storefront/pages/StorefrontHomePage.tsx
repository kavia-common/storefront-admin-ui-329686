import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { shopizerApi } from "../../../api";
import type { CategoryNode, CategoryTreeResult } from "../../../api/shopizerApi";

function getCategoryDisplayName(category: CategoryNode): string {
  return (
    category.description?.name ??
    category.descriptions?.[0]?.name ??
    category.code ??
    (typeof category.id === "number" || typeof category.id === "string" ? `Category ${category.id}` : "Untitled category")
  );
}

function getRootCategories(categories: CategoryNode[]): CategoryNode[] {
  // If the API returns a single root with children, we still want to show something useful:
  // - Prefer showing direct children if present.
  if (categories.length === 1 && Array.isArray(categories[0]?.children) && categories[0].children.length > 0) {
    return categories[0].children;
  }
  return categories;
}

// PUBLIC_INTERFACE
export function StorefrontHomePage() {
  /** Storefront landing page: quick navigation + a small preview of catalog categories (when supported by backend). */
  const [result, setResult] = useState<CategoryTreeResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      const r = await shopizerApi.catalog.getCategoryTree({ store: "DEFAULT", signal: controller.signal });
      setResult(r);
      setLoading(false);
    };

    void load();

    return () => controller.abort();
  }, []);

  const categoryPreview = useMemo(() => {
    if (!result?.ok) return [];
    const roots = getRootCategories(result.categories);
    return roots.slice(0, 6);
  }, [result]);

  return (
    <div>
      <div className="pageTitleRow">
        <h1>Storefront</h1>
        <span className="badge">Step 3</span>
      </div>

      <p className="pageSubtitle">
        Browse the catalog using real API calls where available (via the Vite <code>/api</code> proxy).
      </p>

      <div className="grid" aria-label="Quick actions">
        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Shop</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Start by browsing categories.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/categories">Go to Categories →</Link>
          </p>
        </div>

        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Products</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Product listing will be connected in a later step.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/products">View Products →</Link>
          </p>
        </div>

        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Cart</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Cart APIs will be integrated next.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/cart">Open Cart →</Link>
          </p>
        </div>
      </div>

      <div className="card" aria-label="Category preview">
        <h2 style={{ marginTop: 0 }}>Category preview</h2>

        {loading && <p className="muted">Loading categories…</p>}

        {!loading && !result && <p className="muted">No data loaded yet.</p>}

        {!loading && result && !result.ok && (
          <div className="alert" role="status">
            <div className="alertTitle">Could not load categories from backend</div>
            <div className="muted">
              {result.status ? (
                <>
                  HTTP <strong>{result.status}</strong>
                </>
              ) : (
                "Request failed"
              )}
              {result.url ? (
                <>
                  {" "}
                  · <span>URL: </span>
                  <code>{result.url}</code>
                </>
              ) : null}
            </div>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
              {result.status === 404 ? (
                <>
                  The categories endpoint may not be available in the currently running backend. You can still use
                  navigation, and the UI will display helpful fallback states.
                </>
              ) : (
                <>{result.error ?? "Unknown error"}</>
              )}
            </p>

            {result.status !== 404 && (
              <details style={{ marginTop: "0.65rem" }}>
                <summary className="muted">Diagnostics (response body)</summary>
                <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                  {result.bodyText ? result.bodyText.slice(0, 4000) : "(empty body)"}
                </pre>
              </details>
            )}
          </div>
        )}

        {!loading && result?.ok && categoryPreview.length === 0 && (
          <p className="muted">No categories were returned by the backend.</p>
        )}

        {!loading && result?.ok && categoryPreview.length > 0 && (
          <>
            <ul style={{ marginTop: 0 }}>
              {categoryPreview.map((c, idx) => (
                <li key={`${c.code ?? c.id ?? "cat"}-${idx}`}>
                  <strong>{getCategoryDisplayName(c)}</strong>{" "}
                  {typeof c.productCount === "number" ? (
                    <span className="muted">· {c.productCount} products</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p style={{ marginBottom: 0 }}>
              <Link to="/categories">See full category tree →</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
