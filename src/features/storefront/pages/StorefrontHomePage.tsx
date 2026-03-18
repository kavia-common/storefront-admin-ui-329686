import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { shopizerApi } from "../../../api";
import type { CategoryNode, CategoryTreeResult } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

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
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const [result, setResult] = useState<CategoryTreeResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      const r = await shopizerApi.catalog.getCategoryTree({ signal: controller.signal });
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
      <div className="hero" aria-label="Storefront hero">
        <h1 className="heroTitle">Shop smarter with Shopizer</h1>
        <p className="heroBody">
          {showDeveloperDetails ? (
            <>
              Browse products and categories using real API calls where available (via the Vite <code>/api</code> proxy). This UI is styled as a
              production-grade storefront while keeping all behavior unchanged.
            </>
          ) : (
            <>Browse products and categories, add items to your cart, and try the checkout experience.</>
          )}
        </p>

        <div className="heroActions">
          <Link to="/products" className="navLink navLinkActive" aria-label="Shop products">
            Shop products
          </Link>
          <Link to="/categories" className="navLink" aria-label="Browse categories">
            Browse categories
          </Link>
          <Link to="/cart" className="navLink" aria-label="Open cart">
            View cart
          </Link>
        </div>
      </div>

      <div className="grid" aria-label="Quick actions">
        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Shop by category</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Explore the full category tree and discover what’s available in this store.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/categories">Go to Categories →</Link>
          </p>
        </div>

        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Browse products</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Filter by SKU/type/availability and add items to cart.
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/products">View Products →</Link>
          </p>
        </div>

        <div className="gridCard gridCol4">
          <h2 style={{ marginTop: 0 }}>Checkout</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Try the checkout flow with shipping quotes (backend when available, placeholders otherwise).
          </p>
          <p style={{ marginBottom: 0 }}>
            <Link to="/checkout">Go to Checkout →</Link>
          </p>
        </div>
      </div>

      <div className="card" aria-label="Featured categories">
        <div className="pageTitleRow" style={{ marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>Featured categories</h2>
          <span className="badge" title="Best-effort from backend category tree">
            <span className="badgeDot" aria-hidden="true" />
            Featured
          </span>
        </div>

        {loading && <p className="muted">Loading categories…</p>}

        {!loading && !result && <p className="muted">No data loaded yet.</p>}

        {!loading && result && !result.ok && (
          <div className="alert alertWarning" role="status">
            <div className="alertTitle">Could not load categories</div>

            {showDeveloperDetails && (
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
            )}

            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
              {result.status === 404 ? (
                showDeveloperDetails ? (
                  <>
                    Category loading uses only the modern catalog endpoint. A 404 usually means the API gateway is not routing{" "}
                    <code>/api/v1/catalog/**</code>, or the configured store UUID does not exist.
                  </>
                ) : (
                  <>Please try again later. If the issue persists, contact support.</>
                )
              ) : (
                <>{result.error ?? "Unknown error"}</>
              )}
            </p>

            {showDeveloperDetails && result.status !== 404 && (
              <details style={{ marginTop: "0.65rem" }}>
                <summary className="muted">Diagnostics (response body)</summary>
                <pre className="codeBlock" style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                  {result.bodyText ? result.bodyText.slice(0, 4000) : "(empty body)"}
                </pre>
              </details>
            )}
          </div>
        )}

        {!loading && result?.ok && categoryPreview.length === 0 && <p className="muted">No categories were returned.</p>}

        {!loading && result?.ok && categoryPreview.length > 0 && (
          <>
            <div className="grid" aria-label="Category cards" style={{ marginTop: "0.75rem" }}>
              {categoryPreview.map((c, idx) => (
                <div key={`${c.code ?? c.id ?? "cat"}-${idx}`} className="gridCard gridCol4">
                  <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{getCategoryDisplayName(c)}</div>
                  <div className="muted" style={{ marginTop: "0.25rem" }}>
                    {typeof c.productCount === "number" ? (
                      <>
                        <span className="pill">{c.productCount} products</span>
                      </>
                    ) : (
                      "Browse items in this category"
                    )}
                  </div>
                  <div className="toolbar" style={{ marginTop: "0.75rem" }}>
                    <Link to="/categories">Explore →</Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="toolbar" style={{ justifyContent: "space-between" }}>
              <span className="muted">Want the full taxonomy?</span>
              <Link to="/categories">See full category tree →</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
