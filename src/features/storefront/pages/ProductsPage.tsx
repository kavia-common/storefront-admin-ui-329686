import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { shopizerApi } from "../../../api";
import type { ProductListResult, ProductSummaryResponse } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { useCart } from "../cart/useCart";

function formatInstant(instant: string | undefined): string {
  if (!instant) return "—";
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return instant;
  // Stable-ish rendering across environments; keep readable and sortable.
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function matchesQuery(product: ProductSummaryResponse, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    product.sku.toLowerCase().includes(q) ||
    product.type.toLowerCase().includes(q) ||
    (product.available ? "available" : "unavailable").includes(q)
  );
}

// PUBLIC_INTERFACE
export function ProductsPage() {
  /** Storefront products list: backed by real catalog-service endpoint (via /api proxy). */
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const [result, setResult] = useState<ProductListResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const { addItem, totalItems: cartCount, loading: cartBusy, error: cartError } = useCart();
  const [addingSku, setAddingSku] = useState<string | null>(null);

  const pageSize = 20;

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    const r = await shopizerApi.catalog.listProducts({
      page,
      size: pageSize,
      signal,
    });
    setResult(r);
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const products = useMemo(() => (result?.ok ? result.products : []), [result]);
  const filtered = useMemo(() => products.filter((p) => matchesQuery(p, filter)), [products, filter]);

  const pageMeta = result?.ok ? result.page : undefined;
  const totalPages = pageMeta?.totalPages ?? undefined;
  const canPrev = page > 0;
  const canNext = typeof totalPages === "number" ? page + 1 < totalPages : products.length === pageSize;

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Products</h1>
          <p className="pageSubtitle">
            {showDeveloperDetails ? (
              <>
                Loaded from <code>/api/v1/catalog/stores/&lt;storeId&gt;/products</code>.{" "}
              </>
            ) : (
              <>Browse products and add items to your cart. </>
            )}
            <span className="muted">
              Cart items: <strong>{cartCount}</strong>
            </span>
          </p>
        </div>
        <span className="badge">
          <span className="badgeDot" aria-hidden="true" />
          Catalog
        </span>
      </div>

      <div className="toolbar" aria-label="Product filters">
        <label>
          <span className="muted" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 800 }}>
            Search
          </span>
          <input
            className="textInput"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder='SKU, type, availability (e.g. "SKU-1", "GENERAL", "available")'
            aria-label="Filter products"
          />
        </label>

        <button className="btn btnGhost" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {loading && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Loading products…
          </p>
        </div>
      )}

      {!loading && result && !result.ok && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Unable to load products</h2>
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

          {result.status === 404 ? (
            <div className="alert alertWarning" role="status">
              <div className="alertTitle">Catalog unavailable</div>
              {showDeveloperDetails ? (
                <p style={{ marginBottom: 0 }}>
                  A 404 usually means the API gateway is not routing <code>/api/v1/catalog/**</code> to the catalog
                  service, or the configured store UUID does not exist (see <code>VITE_DEFAULT_STORE_ID</code>).
                </p>
              ) : (
                <p style={{ marginBottom: 0 }}>Please try again later. If the issue persists, contact support.</p>
              )}
            </div>
          ) : (
            <>
              <p style={{ marginBottom: 0, color: "crimson", whiteSpace: "pre-wrap" }}>
                {result.error ?? "Unknown error"}
              </p>

              {showDeveloperDetails && (
                <details style={{ marginTop: "0.75rem" }}>
                  <summary className="muted">Diagnostics (response body)</summary>
                  <pre className="codeBlock" style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                    {result.bodyText ? result.bodyText.slice(0, 4000) : "(empty body)"}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {!loading && result?.ok && products.length === 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No products</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            The backend responded successfully, but returned an empty product page.
          </p>
        </div>
      )}

      {!loading && result?.ok && products.length > 0 && filtered.length === 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No matches</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Try a different query. Tip: searching by <code>SKU</code> is usually the most reliable.
          </p>
        </div>
      )}

      {!loading && result?.ok && filtered.length > 0 && (
        <>
          <div className="pageTitleRow" style={{ marginTop: "1rem" }}>
            <h2 style={{ margin: 0 }}>Product grid</h2>
            <span className="muted">
              {filtered.length} shown{" "}
              {typeof pageMeta?.totalElements === "number" ? <>· {pageMeta.totalElements} total</> : null}
            </span>
          </div>

          <div className="productGrid" aria-label="Products">
            {filtered.map((p) => (
              <article key={`${p.merchantStoreId}-${p.sku}`} className="productCard">
                <div className="productSku">
                  <Link to={`/products/${encodeURIComponent(p.sku)}`}>{p.sku}</Link>
                </div>

                <div className="productMetaRow">
                  <span className="pill">Type: {p.type}</span>
                  <span className={`pill ${p.available ? "pillOk" : "pillNo"}`}>
                    {p.available ? "Available" : "Unavailable"}
                  </span>
                </div>

                <div className="muted" style={{ fontWeight: 650 }}>
                  Updated: <code>{formatInstant(p.updatedAt)}</code>
                </div>

                <div className="toolbar" style={{ marginTop: "0.25rem" }}>
                  <button
                    className="btn btnPrimary"
                    onClick={() => {
                      setAddingSku(p.sku);
                      void addItem({ productId: p.id, sku: p.sku, quantity: 1 }).finally(() => setAddingSku(null));
                    }}
                    disabled={cartBusy || addingSku === p.sku}
                    aria-label={`Add ${p.sku} to cart`}
                  >
                    {addingSku === p.sku ? "Adding…" : "Add to cart"}
                  </button>

                  <Link to={`/products/${encodeURIComponent(p.sku)}`}>View details →</Link>
                </div>
              </article>
            ))}
          </div>

          {cartError && (
            <div className="alert alertInfo" role="status">
              <div className="alertTitle">Cart notice</div>
              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{cartError}</p>
            </div>
          )}

          <div className="toolbar" aria-label="Pagination" style={{ justifyContent: "space-between" }}>
            <div className="muted">
              Page <strong>{page + 1}</strong>
              {typeof totalPages === "number" ? (
                <>
                  {" "}
                  of <strong>{totalPages}</strong>
                </>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn btnGhost" onClick={() => setPage((p0) => Math.max(0, p0 - 1))} disabled={!canPrev || loading}>
                ← Prev
              </button>
              <button className="btn btnGhost" onClick={() => setPage((p0) => p0 + 1)} disabled={!canNext || loading}>
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
