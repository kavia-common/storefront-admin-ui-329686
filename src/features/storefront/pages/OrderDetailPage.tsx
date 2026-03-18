import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { shopizerApi, type OrderResponse } from "../../../api";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { getLocalOrderById, type LocalOrderHistoryEntry } from "../checkout/checkoutSession";

function formatIso(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatMinorUnits(amountMinor: number | undefined, currency: string | undefined): string {
  if (amountMinor === undefined || amountMinor === null) return "—";
  const c = currency?.trim() || "USD";
  const major = amountMinor / 100;

  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(major);
  } catch {
    return `${major.toFixed(2)} ${c}`;
  }
}

type ViewMode = "backend" | "local";

function shortId(id: string): string {
  const t = (id ?? "").trim();
  if (!t) return "—";
  return t.length > 10 ? `${t.slice(0, 8)}…` : t;
}

// PUBLIC_INTERFACE
export function OrderDetailPage() {
  /**
   * Storefront order detail page.
   *
   * Backend:
   * - GET /api/orders/{orderId}
   *
   * Fallback:
   * - local history entry stored at checkout time (per storeId + customerId)
   */
  const { orderId = "" } = useParams<{ orderId: string }>();
  const decodedOrderId = useMemo(() => {
    try {
      return decodeURIComponent(orderId);
    } catch {
      return orderId;
    }
  }, [orderId]);

  const {
    state: { storeId, customerId },
    derived: { bearerToken, showDeveloperDetails },
  } = useStoreSession();

  const [mode, setMode] = useState<ViewMode>("backend");
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);

  const localEntry: LocalOrderHistoryEntry | null = useMemo(() => {
    if (!decodedOrderId) return null;
    return getLocalOrderById({ storeId, customerId, orderId: decodedOrderId });
  }, [customerId, decodedOrderId, storeId]);

  useEffect(() => {
    if (!bearerToken) setMode("local");
  }, [bearerToken]);

  useEffect(() => {
    if (mode !== "backend") return;
    if (!decodedOrderId) return;

    const controller = new AbortController();
    setLoading(true);
    setBackendError(null);

    void (async () => {
      const r = await shopizerApi.orders.getOrder({
        orderId: decodedOrderId,
        bearerToken,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (r.ok && r.order) {
        setOrder(r.order);
        setLoading(false);
        return;
      }

      setOrder(null);
      setBackendError(
        r.error ??
          "Order detail could not be loaded from the backend. The service may be unavailable or may require authentication.",
      );
      setLoading(false);
    })();

    return () => controller.abort();
  }, [bearerToken, decodedOrderId, mode]);

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Order</h1>
          <p className="pageSubtitle">
            <Link to="/account/orders">← Back to orders</Link>
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      <p className="pageSubtitle">
        {showDeveloperDetails ? (
          <>
            Order ID: <code>{decodedOrderId}</code>
          </>
        ) : (
          <>
            Order reference: <strong>{shortId(decodedOrderId)}</strong>
          </>
        )}
      </p>

      <div className="toolbar" aria-label="Order detail source selection">
        <button onClick={() => setMode("backend")} disabled={mode === "backend"}>
          Backend
        </button>
        <button onClick={() => setMode("local")} disabled={mode === "local"}>
          Local fallback
        </button>

        {showDeveloperDetails && (
          <span className="muted">
            {bearerToken ? (
              <>
                Backend requests will include <code>VITE_DEV_BEARER_TOKEN</code>.
              </>
            ) : (
              <>
                No <code>VITE_DEV_BEARER_TOKEN</code> configured — backend is likely secured.
              </>
            )}
          </span>
        )}
      </div>

      {mode === "backend" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Backend order detail</h2>
          {showDeveloperDetails && (
            <p className="muted" style={{ marginTop: 0 }}>
              Calls <code>GET /api/orders/{`{orderId}`}</code>.
            </p>
          )}

          {backendError && (
            <div className="alert" role="status">
              <div className="alertTitle">Backend unavailable</div>
              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{backendError}</p>
              <p className="muted" style={{ margin: "0.5rem 0 0 0" }}>
                If you placed this order in this browser, try <strong>Local fallback</strong>.
              </p>
            </div>
          )}

          {loading ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Loading…
            </p>
          ) : order ? (
            <>
              <div className="grid" aria-label="Order summary">
                <div className="gridCard gridCol6">
                  <h3 style={{ marginTop: 0 }}>Summary</h3>
                  <div className="muted">
                    <div>
                      Status: <strong>{order.status}</strong>
                    </div>
                    <div>
                      Payment: <strong>{order.paymentStatus}</strong>
                    </div>
                    <div>
                      Created: <strong>{formatIso(order.createdAt)}</strong>
                    </div>
                    <div>
                      Updated: <strong>{formatIso(order.updatedAt)}</strong>
                    </div>
                    <div style={{ marginTop: "0.5rem" }}>
                      Total: <strong>{formatMinorUnits(order.totalAmount, order.currency)}</strong>{" "}
                      {showDeveloperDetails ? <span className="muted">(minor: {order.totalAmount})</span> : null}
                    </div>
                  </div>
                </div>

                {showDeveloperDetails && (
                  <div className="gridCard gridCol6">
                    <h3 style={{ marginTop: 0 }}>Context</h3>
                    <div className="muted">
                      <div>
                        Merchant store: <code>{order.merchantStoreId}</code>
                      </div>
                      <div>
                        Customer: <code>{order.customerId}</code>
                      </div>
                      <div>
                        Currency: <strong>{order.currency}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginTop: "1rem" }}>
                <h3 style={{ marginTop: 0 }}>Items</h3>
                {order.items?.length ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Order items table">
                      <thead>
                        <tr style={{ textAlign: "left" }}>
                          <th style={{ padding: "0.5rem 0.25rem" }}>Item</th>
                          <th style={{ padding: "0.5rem 0.25rem" }}>Qty</th>
                          <th style={{ padding: "0.5rem 0.25rem" }}>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((i, idx) => (
                          <tr key={i.id}>
                            <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                              {showDeveloperDetails ? <code>{i.productId}</code> : <>Item {idx + 1}</>}
                            </td>
                            <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                              {i.quantity}
                            </td>
                            <td style={{ padding: "0.6rem 0.25rem", borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                              {formatMinorUnits(i.unitAmount, order.currency)}{" "}
                              {showDeveloperDetails ? <span className="muted">(minor: {i.unitAmount})</span> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted" style={{ marginBottom: 0 }}>
                    No items returned.
                  </p>
                )}

                {showDeveloperDetails && (
                  <details style={{ marginTop: "0.75rem" }}>
                    <summary className="muted">Raw response (debug)</summary>
                    <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>{JSON.stringify(order, null, 2)}</pre>
                  </details>
                )}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              No order data to display.
            </p>
          )}
        </div>
      )}

      {mode === "local" && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Local fallback</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Stored in this browser during checkout.
            {showDeveloperDetails ? (
              <>
                {" "}
                For Store <code>{storeId}</code> and Guest customer <code>{customerId}</code>.
              </>
            ) : null}
          </p>

          {!localEntry ? (
            <div className="alert" role="status">
              <div className="alertTitle">Not found locally</div>
              <p style={{ marginBottom: 0 }}>
                This order isn’t present in local history. If you expect it here, ensure you placed it from this browser.
              </p>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                Placed at: <strong>{formatIso(localEntry.placedAt)}</strong>
              </p>

              {showDeveloperDetails && (
                <details open>
                  <summary className="muted">Stored payload (raw)</summary>
                  <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>{JSON.stringify(localEntry.rawOrder, null, 2)}</pre>
                </details>
              )}
            </>
          )}

          <div className="toolbar">
            <Link to="/checkout">Checkout →</Link>
            <Link to="/products">Browse products →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
