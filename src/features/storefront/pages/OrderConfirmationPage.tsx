import { Link, useLocation } from "react-router-dom";
import {
  extractOrderIdFromUnknownOrder,
  getLastCheckoutOrderResult,
  type CheckoutOrderResult,
} from "../checkout/checkoutSession";

type NavState = {
  orderResult?: CheckoutOrderResult;
};



function formatPlacedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// PUBLIC_INTERFACE
export function OrderConfirmationPage() {
  /** Checkout order confirmation page (success/failure) shown after attempting order placement. */
  const location = useLocation();
  const state = (location.state ?? {}) as NavState;

  // Prefer navigation state (immediate), but fall back to stored result for refresh/deep link.
  const orderResult = state.orderResult ?? getLastCheckoutOrderResult();

  if (!orderResult) {
    return (
      <div>
        <div className="pageTitleRow">
          <h1 style={{ marginBottom: 0 }}>Order confirmation</h1>
          <span className="badge">MVP</span>
        </div>

        <div className="alert" role="status">
          <div className="alertTitle">No order data</div>
          <p style={{ marginBottom: 0 }}>
            We couldn’t find an order result to display. This page is normally reached right after placing an order.
          </p>
        </div>

        <div className="toolbar" style={{ marginTop: "1rem" }}>
          <Link to="/checkout">Back to checkout →</Link>
          <Link to="/products">Browse products →</Link>
        </div>
      </div>
    );
  }

  const orderId = orderResult.ok
    ? extractOrderIdFromUnknownOrder(orderResult.order)
    : orderResult.order
      ? extractOrderIdFromUnknownOrder(orderResult.order)
      : null;
  const placedAtText = formatPlacedAt(orderResult.placedAt);

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Order confirmation</h1>
          <p className="pageSubtitle" style={{ marginTop: "0.25rem" }}>
            {orderResult.ok ? "Thank you for your purchase." : "Your order could not be placed."}
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      {orderResult.ok ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Success</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Placed at: <strong>{placedAtText}</strong>
          </p>

          {orderId && (
            <p style={{ marginTop: "0.5rem" }}>
              Order reference: <code>{orderId}</code>
            </p>
          )}

          <details style={{ marginTop: "0.75rem" }}>
            <summary className="muted">Order details (raw response)</summary>
            <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
              {JSON.stringify(orderResult.order, null, 2)}
            </pre>
          </details>

          <div className="toolbar" style={{ marginTop: "1rem" }}>
            <Link to="/products">Continue shopping →</Link>
            <Link to="/account/orders">View orders →</Link>
            {orderId && <Link to={`/account/orders/${encodeURIComponent(orderId)}`}>View this order →</Link>}
            <Link to="/cart">View cart →</Link>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Payment/checkout failed</h2>

          <div className="alert" role="status">
            <div className="alertTitle">We couldn’t place your order</div>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{orderResult.error}</p>
          </div>

          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Attempted at: <strong>{placedAtText}</strong>
          </p>

          {orderId && (
            <p style={{ marginTop: "0.5rem" }}>
              Reference found in response: <code>{orderId}</code>
            </p>
          )}

          {orderResult.order !== undefined && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary className="muted">Response details (raw)</summary>
              <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                {JSON.stringify(orderResult.order, null, 2)}
              </pre>
            </details>
          )}

          <div className="toolbar" style={{ marginTop: "1rem" }}>
            <Link to="/checkout">Back to checkout →</Link>
            <Link to="/account/orders">View orders →</Link>
            {orderId && <Link to={`/account/orders/${encodeURIComponent(orderId)}`}>Try view this order →</Link>}
            <Link to="/cart">Back to cart →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
