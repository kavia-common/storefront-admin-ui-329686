import { Link } from "react-router-dom";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { useCart } from "../cart/useCart";

// PUBLIC_INTERFACE
export function CartPage() {
  /** Cart page: uses backend cart-service when available and falls back to localStorage cart in preview/offline mode. */
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const { cart, loading, error, totalItems, refresh, setQuantity, removeItem, clear } = useCart();

  const canCheckout = cart.mode === "backend" && Boolean(cart.cartId) && totalItems > 0;

  return (
    <div>
      <div className="pageTitleRow">
        <h1>Cart</h1>
        <span className="badge">{cart.mode === "backend" ? "Backend cart" : "Local cart"}</span>
      </div>

      <p className="pageSubtitle">
        Items: <strong>{totalItems}</strong>{" "}
        <span className="muted">
          ·{" "}
          {cart.mode === "backend"
            ? showDeveloperDetails
              ? "Backed by /api/v1/carts/** (when cart-service is running)"
              : "Synced with the server (when available)"
            : "Stored in your browser"}
        </span>
      </p>

      <div className="toolbar" aria-label="Cart actions">
        <button onClick={() => void refresh({ forceBackend: true })} disabled={loading}>
          {loading ? "Refreshing…" : "Try backend cart"}
        </button>
        <button onClick={() => void refresh({ forceLocal: true })} disabled={loading}>
          Use local cart
        </button>
        <button onClick={() => void clear()} disabled={loading || totalItems === 0}>
          Clear local cart
        </button>
        <Link to="/products">Continue shopping →</Link>
      </div>

      {error && (
        <div className="alert" role="status">
          <div className="alertTitle">Cart notice</div>
          <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{error}</p>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Items</h2>

        {totalItems === 0 && <p className="muted">Your cart is empty.</p>}

        {totalItems > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.25rem" }}>Product</th>
                  <th style={{ padding: "0.5rem 0.25rem" }}>Quantity</th>
                  <th style={{ padding: "0.5rem 0.25rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map((i) => (
                  <tr key={i.productId}>
                    <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <div>
                        {i.sku ? (
                          <Link to={`/products/${encodeURIComponent(i.sku)}`}>
                            <strong>{i.sku}</strong>
                          </Link>
                        ) : (
                          <strong className="muted">(unknown SKU)</strong>
                        )}
                      </div>
                      {showDeveloperDetails && (
                        <div className="muted">
                          Product ID: <code>{i.productId}</code>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <input
                        className="textInput"
                        style={{ width: 140 }}
                        type="number"
                        min={0}
                        step={1}
                        value={i.quantity}
                        onChange={(e) => void setQuantity({ productId: i.productId, quantity: Number(e.target.value) })}
                        aria-label={`Quantity for ${i.sku ?? i.productId}`}
                        disabled={loading}
                      />
                      <div className="muted" style={{ fontSize: "0.9rem" }}>
                        Set to 0 to remove
                      </div>
                    </td>

                    <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                      <button onClick={() => void removeItem({ productId: i.productId })} disabled={loading}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Checkout</h2>

        {!canCheckout && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Checkout requires the backend checkout services to be available. In some environments, services may be running in a limited
              configuration.
            </p>
            {showDeveloperDetails && (
              <p style={{ marginBottom: 0 }}>
                Tip: if you have a dev JWT, set <code>VITE_DEV_BEARER_TOKEN</code> and click “Try backend cart”.
              </p>
            )}
          </>
        )}

        {canCheckout && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Proceed to the checkout flow (address + shipping + payment placeholders).
            </p>
            <p style={{ marginBottom: 0 }}>
              <Link to="/checkout">Go to Checkout →</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
