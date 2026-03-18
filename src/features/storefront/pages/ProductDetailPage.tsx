import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { shopizerApi } from "../../../api";
import type { ProductDetailResult, ProductDetailResponse } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { useCart } from "../cart/useCart";

function formatInstant(instant: string | undefined): string {
  if (!instant) return "—";
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return instant;
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function getPrimaryName(product: ProductDetailResponse): string | null {
  const first = product.descriptions?.[0];
  if (!first) return null;
  return first.name?.trim() ? first.name.trim() : null;
}

// PUBLIC_INTERFACE
export function ProductDetailPage() {
  /** Storefront product detail: fetches a product by SKU and shows core + localized fields. */
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const params = useParams();
  const sku = useMemo(() => {
    const raw = params.sku;
    return raw ? decodeURIComponent(raw) : "";
  }, [params.sku]);

  const [result, setResult] = useState<ProductDetailResult | null>(null);
  const [loading, setLoading] = useState(false);

  const { addItem, loading: cartBusy, error: cartError, totalItems: cartCount } = useCart();
  const [qty, setQty] = useState(1);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!sku) return;

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      const r = await shopizerApi.catalog.getProductBySku({
        sku,
        signal: controller.signal,
      });
      setResult(r);
      setLoading(false);
    };

    void load();

    return () => controller.abort();
  }, [sku]);

  const title = useMemo(() => {
    if (!result?.ok || !result.product) return sku ? `Product: ${sku}` : "Product";
    const name = getPrimaryName(result.product);
    return name ? `${name} (${result.product.sku})` : `Product: ${result.product.sku}`;
  }, [result, sku]);

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>{title}</h1>
          <p className="pageSubtitle">
            <Link to="/products">← Back to Products</Link>
          </p>
        </div>
        <span className="badge">
          <span className="badgeDot" aria-hidden="true" />
          Product
        </span>
      </div>

      {!sku && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Missing SKU</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            This page requires a product SKU in the URL.
          </p>
        </div>
      )}

      {sku && loading && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Loading product…
          </p>
        </div>
      )}

      {sku && !loading && result && !result.ok && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Unable to load product</h2>
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
              <div className="alertTitle">Product not found</div>
              <p style={{ marginBottom: 0 }}>
                {showDeveloperDetails ? (
                  <>
                    The SKU <code>{sku}</code> does not exist for the configured store, or the gateway is not routing{" "}
                    <code>/api/v1/catalog/**</code> to the catalog service.
                  </>
                ) : (
                  <>
                    We couldn’t find that product. Please check the link or return to <Link to="/products">Products</Link>.
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <p style={{ marginBottom: 0, color: "crimson", whiteSpace: "pre-wrap" }}>{result.error ?? "Unknown error"}</p>
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

      {sku && !loading && result?.ok && result.product && (
        <div className="twoCol" aria-label="Product layout">
          <div>
            <div className="card">
              <div className="pageTitleRow">
                <h2 style={{ margin: 0 }}>Overview</h2>
                <span className={`pill ${result.product.available ? "pillOk" : "pillNo"}`}>
                  {result.product.available ? "Available" : "Unavailable"}
                </span>
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "170px 1fr", gap: "0.5rem 1rem", margin: "0.9rem 0 0 0" }}>
                <dt className="muted">SKU</dt>
                <dd style={{ margin: 0 }}>
                  <code>{result.product.sku}</code>
                </dd>

                <dt className="muted">Type</dt>
                <dd style={{ margin: 0 }}>{result.product.type}</dd>

                <dt className="muted">Created</dt>
                <dd style={{ margin: 0 }}>
                  <code>{formatInstant(result.product.createdAt)}</code>
                </dd>

                <dt className="muted">Updated</dt>
                <dd style={{ margin: 0 }}>
                  <code>{formatInstant(result.product.updatedAt)}</code>
                </dd>

                {showDeveloperDetails && (
                  <>
                    <dt className="muted">Product ID</dt>
                    <dd style={{ margin: 0 }}>
                      <code>{result.product.id}</code>
                    </dd>
                  </>
                )}
              </dl>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Descriptions</h2>

              {(!result.product.descriptions || result.product.descriptions.length === 0) && (
                <p className="muted" style={{ marginBottom: 0 }}>
                  No descriptions were returned.
                </p>
              )}

              {result.product.descriptions && result.product.descriptions.length > 0 && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  {result.product.descriptions.map((d) => (
                    <div key={d.languageId} className="subCard">
                      {showDeveloperDetails && (
                        <div className="muted" style={{ marginBottom: "0.25rem" }}>
                          Language: <code>{d.languageId}</code>
                        </div>
                      )}
                      <div style={{ fontWeight: 900 }}>{d.name || "(no name)"}</div>
                      {d.friendlyUrl ? (
                        <div className="muted">
                          Friendly URL: <code>{d.friendlyUrl}</code>
                        </div>
                      ) : null}
                      {d.description ? (
                        <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{d.description}</p>
                      ) : (
                        <p className="muted" style={{ marginBottom: 0 }}>
                          (no description)
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="card" aria-label="Purchase panel">
              <h2 style={{ marginTop: 0 }}>Add to cart</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Cart items: <strong>{cartCount}</strong> · Uses backend cart-service when available, otherwise falls back to a local (preview) cart.
              </p>

              <div className="toolbar" aria-label="Add to cart controls" style={{ marginTop: "0.5rem" }}>
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  <span className="muted" style={{ fontWeight: 800 }}>
                    Quantity
                  </span>
                  <input
                    className="textInput"
                    style={{ width: 160 }}
                    type="number"
                    min={1}
                    step={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    aria-label="Quantity"
                  />
                </label>

                <button
                  className="btn btnPrimary"
                  onClick={() => {
                    setAddedMessage(null);
                    void addItem({ productId: result.product!.id, sku: result.product!.sku, quantity: qty }).then((r) => {
                      setAddedMessage(r.mode === "backend" ? "Added to cart." : "Added to cart (saved in this browser).");
                    });
                  }}
                  disabled={cartBusy}
                >
                  {cartBusy ? "Adding…" : "Add to cart"}
                </button>
              </div>

              <div className="toolbar" style={{ justifyContent: "space-between" }}>
                <Link to="/cart">View cart →</Link>
                <Link to="/checkout">Checkout →</Link>
              </div>

              {addedMessage && (
                <div className="alert alertSuccess" role="status">
                  <div className="alertTitle">Added</div>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    {addedMessage}
                  </p>
                </div>
              )}

              {cartError && (
                <div className="alert alertInfo" role="status">
                  <div className="alertTitle">Cart notice</div>
                  <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{cartError}</p>
                </div>
              )}
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Need help?</h2>
              <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
                If something doesn’t look right, return to <Link to="/products">Products</Link> and try again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
