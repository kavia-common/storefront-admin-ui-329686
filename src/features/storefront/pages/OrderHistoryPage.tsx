import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { shopizerApi } from "../../../api";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { getLocalOrderHistory, type LocalOrderHistoryEntry } from "../checkout/checkoutSession";

function formatIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type DataSource = "backend" | "local";

function shortId(id: string): string {
  const t = (id ?? "").trim();
  if (!t) return "—";
  return t.length > 10 ? `${t.slice(0, 8)}…` : t;
}

// PUBLIC_INTERFACE
export function OrderHistoryPage() {
  /**
   * Storefront order history page.
   *
   * Behavior:
   * - Tries the secured modern order-service (GET /api/orders) when a dev bearer token is configured.
   * - Falls back to local history persisted at checkout time (per storeId + customerId).
   */
  const {
    state: { storeId, customerId },
    derived: { bearerToken, showDeveloperDetails },
  } = useStoreSession();

  const [source, setSource] = useState<DataSource>("backend");
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      createdAt?: string;
      status?: string;
      paymentStatus?: string;
      currency?: string;
      totalAmount?: number;
      itemsCount?: number;
    }>
  >([]);

  const localOrders = useMemo<LocalOrderHistoryEntry[]>(
    () => getLocalOrderHistory({ storeId, customerId }),
    [storeId, customerId],
  );

  useEffect(() => {
    // If we don't have a token, default to local to avoid noisy 401s (while still allowing user to switch).
    if (!bearerToken) setSource("local");
  }, [bearerToken]);

  useEffect(() => {
    if (source !== "backend") return;

    const controller = new AbortController();
    setLoading(true);
    setBackendError(null);

    void (async () => {
      const r = await shopizerApi.orders.listOrders({
        merchantStoreId: storeId,
        customerId,
        bearerToken,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (r.ok) {
        setOrders(
          r.orders.map((o) => ({
            id: o.id,
            createdAt: o.createdAt,
            status: o.status,
            paymentStatus: o.paymentStatus,
            currency: o.currency,
            totalAmount: o.totalAmount,
            itemsCount: o.items?.length ?? 0,
          })),
        );
        setLoading(false);
        return;
      }

      setOrders([]);
      setBackendError(
        r.error ??
          "Order history could not be loaded from the backend. The endpoint may be unavailable or may require authentication.",
      );
      setLoading(false);
    })();

    return () => controller.abort();
  }, [bearerToken, customerId, source, storeId]);

  const showBackend = source === "backend";
  const showLocal = source === "local";

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Orders</h1>
          <p className="pageSubtitle">
            <Link to="/account">← Back to My Account</Link>
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      {showDeveloperDetails && (
        <p className="pageSubtitle">
          Store: <code>{storeId}</code> · Guest customer: <code>{customerId}</code>
        </p>
      )}

      <div className="toolbar" aria-label="Order history source selection">
        <button onClick={() => setSource("backend")} disabled={showBackend}>
          Backend
        </button>
        <button onClick={() => setSource("local")} disabled={showLocal}>
          Local (fallback)
        </button>

        {showDeveloperDetails && (
          <span className="muted">
            {bearerToken ? (
              <>Using an authenticated bearer token from the current session for backend requests (dev token or customer login).</>
            ) : (
              <>No bearer token available in session — backend orders are likely secured, so local fallback is recommended.</>
            )}
          </span>
        )}
      </div>

      {showBackend && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Backend order history</h2>
          {showDeveloperDetails && (
            <p className="muted" style={{ marginTop: 0 }}>
              Calls <code>GET /api/orders?merchantStoreId=…&customerId=…</code>. Requires auth in the modern stack.
            </p>
          )}

          {backendError && (
            <div className="alert" role="status">
              <div className="alertTitle">Backend unavailable</div>
              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{backendError}</p>
              <p className="muted" style={{ margin: "0.5rem 0 0 0" }}>
                You can switch to <strong>Local (fallback)</strong> to view orders captured during checkout in this browser.
              </p>
            </div>
          )}

          {loading ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Loading…
            </p>
          ) : orders.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              No orders found{backendError ? " (backend returned no data)" : ""}.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Order history table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Order</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Created</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Status</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Payment</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Items</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, idx) => (
                    <tr key={o.id}>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <Link to={`/account/orders/${encodeURIComponent(o.id)}`}>
                          {showDeveloperDetails ? <code>{o.id}</code> : <>Order {idx + 1} ({shortId(o.id)})</>}
                        </Link>
                      </td>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <span className="muted">{o.createdAt ? formatIso(o.createdAt) : "—"}</span>
                      </td>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>{o.status ?? "—"}</td>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        {o.paymentStatus ?? "—"}
                      </td>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>{o.itemsCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showLocal && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Local order history (fallback)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Orders stored locally in this browser when checkout succeeds.
            {showDeveloperDetails ? (
              <>
                {" "}
                This is scoped to the current Store UUID and guest customer id.
              </>
            ) : null}
          </p>

          {localOrders.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              No locally recorded orders yet. Place an order via <Link to="/checkout">Checkout</Link> to populate this list.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Local order history table">
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Order</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Placed at</th>
                  </tr>
                </thead>
                <tbody>
                  {localOrders.map((o, idx) => (
                    <tr key={o.id}>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <Link to={`/account/orders/${encodeURIComponent(o.id)}`}>
                          {showDeveloperDetails ? <code>{o.id}</code> : <>Order {idx + 1} ({shortId(o.id)})</>}
                        </Link>
                      </td>
                      <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                        <span className="muted">{formatIso(o.placedAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="toolbar">
            <Link to="/products">Browse products →</Link>
            <Link to="/checkout">Checkout →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
