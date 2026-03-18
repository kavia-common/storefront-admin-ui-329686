import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shopizerApi } from "../../../api";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";
import { useCart } from "../cart/useCart";
import { clearBackendCartId } from "../cart/cartSession";
import {
  getCheckoutPaymentMethodId,
  setCheckoutPaymentMethodId,
  recordSuccessfulOrderToLocalHistory,
  setLastCheckoutOrderResult,
  type CheckoutOrderResult,
} from "../checkout/checkoutSession";

type AddressDraft = {
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

type UiShippingOption = {
  /** Stable selection key (provider:serviceLevel) or placeholder id. */
  key: string;
  label: string;
  detail: string;
  amount?: number;
  currency?: string;

  /** Present only for real backend quotes. */
  provider?: string;
  serviceLevel?: string;
  source: "backend" | "placeholder";
};

type PaymentOption = {
  id: string;
  label: string;
  detail: string;
};

function isAddressReady(a: AddressDraft): boolean {
  return Boolean(
    a.fullName.trim() &&
      a.address1.trim() &&
      a.city.trim() &&
      a.region.trim() &&
      a.postalCode.trim() &&
      a.country.trim(),
  );
}

function formatMoney(amount: number, currency: string): string {
  // Keep deterministic formatting in case Intl is missing currency; fallback to a simple string.
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function buildPlaceholderOptions(): UiShippingOption[] {
  return [
    {
      key: "placeholder:standard",
      label: "Standard",
      detail: "5–7 business days (placeholder)",
      source: "placeholder",
    },
    {
      key: "placeholder:express",
      label: "Express",
      detail: "2–3 business days (placeholder)",
      source: "placeholder",
    },
    {
      key: "placeholder:overnight",
      label: "Overnight",
      detail: "Next business day (placeholder)",
      source: "placeholder",
    },
  ];
}

// PUBLIC_INTERFACE
export function CheckoutPage() {
  /**
   * Checkout flow UI (MVP):
   * - Step 1: Address entry (stored in component state; later can be persisted)
   * - Step 2: Shipping selection (tries real quotes from shipping-service; falls back to placeholders)
   * - Step 3: Payment selection (placeholder options)
   * - Final: calls existing checkout API when backend cart is available:
   *   POST /api/checkout/orders (via shopizerApi.checkout.createOrderFromCart)
   */
  const navigate = useNavigate();
  const { cart, loading: cartLoading, error: cartError, totalItems, clear: clearCart } = useCart();
  const {
    state: { storeId, customerId, currency, showDeveloperDetails },
    derived: { bearerToken },
  } = useStoreSession();

  const [address, setAddress] = useState<AddressDraft>(() => ({
    fullName: "",
    address1: "",
    address2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "US",
  }));

  const paymentOptions: PaymentOption[] = useMemo(
    () => [
      { id: "card", label: "Credit card", detail: "Card entry will be added later (placeholder)" },
      { id: "paypal", label: "PayPal", detail: "PayPal redirect will be added later (placeholder)" },
      { id: "cod", label: "Cash on delivery", detail: "For demo/testing only (placeholder)" },
    ],
    [],
  );

  const addressReady = isAddressReady(address);

  const [shippingOptions, setShippingOptions] = useState<UiShippingOption[]>(() => buildPlaceholderOptions());
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [selectedShippingKey, setSelectedShippingKey] = useState<string>(() => buildPlaceholderOptions()[0]?.key ?? "");
  const [shippingRefreshNonce, setShippingRefreshNonce] = useState(0);

  // Keep selection valid when options change.
  useEffect(() => {
    if (shippingOptions.length === 0) return;

    const exists = shippingOptions.some((o) => o.key === selectedShippingKey);
    if (!exists) setSelectedShippingKey(shippingOptions[0]!.key);
  }, [selectedShippingKey, shippingOptions]);

  const fetchShippingQuotes = useCallback(
    async (params: { signal?: AbortSignal } = {}) => {
      // Only attempt real quotes when we have enough info to produce a meaningful request.
      if (!addressReady || totalItems <= 0) return;

      setShippingLoading(true);
      setShippingError(null);

      const token = bearerToken;

      // shipping-service expects an item list with sku + weight; our cart DTOs are minimal,
      // so we use SKU when present and fall back to productId. Weight is a deterministic placeholder for now.
      const defaultItemWeightGrams = 500;

      const r = await shopizerApi.shipping.getQuotes({
        request: {
          destination: {
            country: address.country.trim().toUpperCase(),
            postalCode: address.postalCode.trim(),
            region: address.region.trim(),
          },
          currency,
          items: cart.items.map((i) => ({
            sku: (i.sku ?? i.productId).trim(),
            quantity: Math.max(1, Math.floor(i.quantity)),
            weightGrams: defaultItemWeightGrams,
          })),
        },
        bearerToken: token,
        signal: params.signal,
      });

      if (r.ok && r.quotes) {
        const quotes = r.quotes.quotes ?? [];
        if (quotes.length === 0) {
          setShippingOptions(buildPlaceholderOptions());
          setShippingError("No shipping options were returned. Showing standard options instead.");
          setShippingLoading(false);
          return;
        }

        setShippingOptions(
          quotes.map((q) => ({
            key: `${q.provider}:${q.serviceLevel}`,
            label: q.serviceName || `${q.provider} ${q.serviceLevel}`,
            detail: `${q.provider} · ${q.serviceLevel}`,
            amount: q.amount,
            currency: r.quotes!.currency,
            provider: q.provider,
            serviceLevel: q.serviceLevel,
            source: "backend",
          })),
        );
        setShippingLoading(false);
        return;
      }

      // Backend not available / not routed / auth required / etc.
      setShippingOptions(buildPlaceholderOptions());
      setShippingError(
        showDeveloperDetails
          ? r.error ??
              "Shipping quotes are currently unavailable (endpoint missing, service down, or auth required). Using placeholder options."
          : "Shipping quotes are currently unavailable. Using standard options instead.",
      );
      setShippingLoading(false);
    },
    [
      address.country,
      address.postalCode,
      address.region,
      addressReady,
      bearerToken,
      cart.items,
      currency,
      showDeveloperDetails,
      totalItems,
    ],
  );

  // Auto-fetch when the user has entered enough address data and there are items in cart.
  useEffect(() => {
    const controller = new AbortController();
    void fetchShippingQuotes({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchShippingQuotes, shippingRefreshNonce]);

  const [paymentId, setPaymentId] = useState<string>(() => {
    const stored = getCheckoutPaymentMethodId();
    return stored ?? paymentOptions[0]?.id ?? "card";
  });

  // Persist selection into a lightweight checkout session so we can later share it across steps/pages.
  useEffect(() => {
    if (!paymentId) return;
    setCheckoutPaymentMethodId(paymentId);
  }, [paymentId]);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<string | null>(null);
  const [debugOrderPayload, setDebugOrderPayload] = useState<unknown | null>(null);

  const canCheckoutWithBackend = cart.mode === "backend" && Boolean(cart.cartId);
  const canPlaceOrder = canCheckoutWithBackend && totalItems > 0 && addressReady && !placingOrder;

  const selectedShipping = useMemo(
    () => shippingOptions.find((o) => o.key === selectedShippingKey) ?? shippingOptions[0],
    [selectedShippingKey, shippingOptions],
  );

  const placeOrder = async () => {
    if (!cart.cartId) return;
    if (!addressReady) return;

    setPlacingOrder(true);
    setPlaceOrderError(null);
    setDebugOrderPayload(null);

    const token = bearerToken;

    const selectedShippingQuote =
      selectedShipping?.source === "backend" && selectedShipping.provider && selectedShipping.serviceLevel
        ? { provider: selectedShipping.provider, serviceLevel: selectedShipping.serviceLevel }
        : { provider: "placeholder", serviceLevel: selectedShippingKey || "standard" };

    const r = await shopizerApi.checkout.createOrderFromCart({
      cartId: cart.cartId,
      merchantStoreId: storeId,
      customerId,
      // Placeholder: "card" | "paypal" | "cod" (UI-only for now). Backend may ignore/override in Phase 1.
      paymentMethod: paymentId,
      // Destination used for tax/shipping estimation in the backend flow.
      destination: {
        country: address.country.trim().toUpperCase(),
        postalCode: address.postalCode.trim(),
        region: address.region.trim(),
      },
      // Placeholder: in the legacy app this is a real merchant store code; keep deterministic for MVP.
      storeCode: "DEFAULT",
      selectedShippingQuote,
      defaultItemWeightGrams: 500,
      bearerToken: token,
    });

    const placedAt = new Date().toISOString();

    if (r.ok) {
      const orderResult: CheckoutOrderResult = { ok: true, placedAt, order: r.json ?? {} };
      setLastCheckoutOrderResult(orderResult);

      // Store a local order history entry for UX even when order-service is unavailable/secured.
      recordSuccessfulOrderToLocalHistory({
        placedAt,
        storeId,
        customerId,
        currency,
        rawOrder: orderResult.order,
      });

      // Clear local fallback cart + drop backend cart id so the next shopping flow starts fresh.
      await clearCart();
      clearBackendCartId();

      navigate("/checkout/confirmation", { state: { orderResult } });
      setPlacingOrder(false);
      return;
    }

    const message = r.error ?? "Checkout failed";
    const orderResult: CheckoutOrderResult = { ok: false, placedAt, error: message, order: r.bodyText || undefined };
    setLastCheckoutOrderResult(orderResult);

    setPlaceOrderError(message);
    setDebugOrderPayload(r.bodyText || null);
    setPlacingOrder(false);
  };

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Checkout</h1>
          <p className="pageSubtitle">
            <Link to="/cart">← Back to cart</Link>
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      <p className="pageSubtitle">
        {showDeveloperDetails ? (
          <>
            Store: <code>{storeId}</code> · Customer: <code>{customerId}</code> · Currency: <strong>{currency}</strong>
          </>
        ) : (
          <>
            Currency: <strong>{currency}</strong>
          </>
        )}
      </p>

      {cartError && (
        <div className="alert" role="status">
          <div className="alertTitle">Cart notice</div>
          <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{cartError}</p>
        </div>
      )}

      <div className="grid" aria-label="Checkout steps">
        <div className="gridCard gridCol6">
          <h2 style={{ marginTop: 0 }}>1) Shipping address</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Collected for shipping/tax estimation. This is a UI-only draft for now.
          </p>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Full name
              </span>
              <input
                className="textInput"
                value={address.fullName}
                onChange={(e) => setAddress((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Jane Doe"
                aria-label="Full name"
                autoComplete="name"
              />
            </label>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Address line 1
              </span>
              <input
                className="textInput"
                value={address.address1}
                onChange={(e) => setAddress((p) => ({ ...p, address1: e.target.value }))}
                placeholder="123 Market St"
                aria-label="Address line 1"
                autoComplete="shipping address-line1"
              />
            </label>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Address line 2 (optional)
              </span>
              <input
                className="textInput"
                value={address.address2}
                onChange={(e) => setAddress((p) => ({ ...p, address2: e.target.value }))}
                placeholder="Apt 5"
                aria-label="Address line 2"
                autoComplete="shipping address-line2"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "0.75rem" }}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  City
                </span>
                <input
                  className="textInput"
                  value={address.city}
                  onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                  placeholder="San Francisco"
                  aria-label="City"
                  autoComplete="shipping address-level2"
                />
              </label>

              <label>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Region/State
                </span>
                <input
                  className="textInput"
                  value={address.region}
                  onChange={(e) => setAddress((p) => ({ ...p, region: e.target.value }))}
                  placeholder="CA"
                  aria-label="Region or state"
                  autoComplete="shipping address-level1"
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "0.75rem" }}>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Postal code
                </span>
                <input
                  className="textInput"
                  value={address.postalCode}
                  onChange={(e) => setAddress((p) => ({ ...p, postalCode: e.target.value }))}
                  placeholder="94107"
                  aria-label="Postal code"
                  autoComplete="shipping postal-code"
                />
              </label>

              <label>
                <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                  Country
                </span>
                <input
                  className="textInput"
                  value={address.country}
                  onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))}
                  placeholder="US"
                  aria-label="Country"
                  autoComplete="shipping country"
                />
              </label>
            </div>

            {!addressReady && (
              <p className="muted" style={{ marginBottom: 0 }}>
                Fill in required address fields to load shipping options and enable “Place order”.
              </p>
            )}
          </div>
        </div>

        <div className="gridCard gridCol6">
          <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "0.75rem" }}>
            <div>
              <h2 style={{ marginTop: 0 }}>2) Shipping method</h2>
              <p className="muted" style={{ marginTop: 0, marginBottom: 0 }}>
                {showDeveloperDetails ? (
                  <>
                    Attempts to load real quotes from <code>POST /api/shipping/quotes</code>. Falls back to placeholders if
                    unavailable.
                  </>
                ) : (
                  <>We’ll show available shipping options (standard options are used when live quotes aren’t available).</>
                )}
              </p>
            </div>

            <button
              onClick={() => setShippingRefreshNonce((n) => n + 1)}
              disabled={shippingLoading || !addressReady || totalItems === 0}
              aria-label="Recalculate shipping quotes"
            >
              {shippingLoading ? "Loading…" : "Recalculate"}
            </button>
          </div>

          {shippingError && (
            <div className="alert" role="status" style={{ marginTop: "0.75rem" }}>
              <div className="alertTitle">Shipping notice</div>
              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{shippingError}</p>
            </div>
          )}

          <fieldset style={{ border: "none", padding: 0, margin: "0.75rem 0 0 0", display: "grid", gap: "0.5rem" }}>
            <legend className="muted" style={{ marginBottom: "0.25rem" }}>
              Select a shipping option
            </legend>

            {shippingOptions.map((o) => {
              const priceText = o.amount !== undefined && o.currency ? ` · ${formatMoney(o.amount, o.currency)}` : "";
              const sourceText = o.source === "backend" ? "Quote" : "Standard";

              return (
                <label
                  key={o.key}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "start",
                    padding: "0.6rem 0.7rem",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <input
                    type="radio"
                    name="shipping"
                    value={o.key}
                    checked={selectedShippingKey === o.key}
                    onChange={() => setSelectedShippingKey(o.key)}
                    aria-label={`Shipping option ${o.label}`}
                    disabled={shippingLoading}
                  />
                  <span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700 }}>{o.label}</div>
                      <div className="muted" style={{ fontSize: "0.9rem" }}>
                        {sourceText}
                        {priceText}
                      </div>
                    </div>
                    <div className="muted">{o.detail}</div>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div style={{ marginTop: "1rem" }}>
            <h2 style={{ marginTop: 0 }}>3) Payment</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Payment collection is a placeholder. This flow currently only demonstrates order creation.
            </p>

            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
              <legend className="muted" style={{ marginBottom: "0.25rem" }}>
                Select a payment method
              </legend>

              {paymentOptions.map((o) => (
                <label
                  key={o.id}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "start",
                    padding: "0.6rem 0.7rem",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={o.id}
                    checked={paymentId === o.id}
                    onChange={() => setPaymentId(o.id)}
                    aria-label={`Payment option ${o.label}`}
                  />
                  <span>
                    <div style={{ fontWeight: 700 }}>{o.label}</div>
                    <div className="muted">{o.detail}</div>
                  </span>
                </label>
              ))}
            </fieldset>
          </div>
        </div>

        <div className="gridCard gridCol6">
          <h2 style={{ marginTop: 0 }}>Order summary</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Items: <strong>{totalItems}</strong> · Mode:{" "}
            <strong>{cart.mode === "backend" ? "Backend cart" : "Local cart (preview)"}</strong>
          </p>

          {totalItems === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Your cart is empty. <Link to="/products">Browse products →</Link>
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Product</th>
                    <th style={{ padding: "0.5rem 0.25rem" }}>Qty</th>
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
                        {i.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="gridCard gridCol6">
          <h2 style={{ marginTop: 0 }}>Place order</h2>

          {!canCheckoutWithBackend && (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                This checkout action requires live backend services. You are currently in <strong>{cart.mode}</strong>{" "}
                mode.
              </p>
              {showDeveloperDetails ? (
                <p style={{ marginBottom: 0 }}>
                  Go to <Link to="/cart">Cart</Link> and click <strong>“Try backend cart”</strong>. If auth is required,
                  set <code>VITE_DEV_BEARER_TOKEN</code>.
                </p>
              ) : (
                <p style={{ marginBottom: 0 }}>
                  Go to <Link to="/cart">Cart</Link> and try switching to the backend cart if available.
                </p>
              )}
            </>
          )}

          {canCheckoutWithBackend && (
            <>
              {showDeveloperDetails && (
                <p className="muted" style={{ marginTop: 0 }}>
                  Calls <code>POST /api/checkout/orders</code> via the shared API client.
                </p>
              )}

              <div className="toolbar" aria-label="Place order" style={{ marginTop: 0 }}>
                <button onClick={() => void placeOrder()} disabled={!canPlaceOrder || cartLoading}>
                  {placingOrder ? "Placing order…" : "Place order (placeholder)"}
                </button>

                <span className="muted">
                  Shipping: <strong>{selectedShipping?.label ?? selectedShippingKey}</strong> · Payment:{" "}
                  <strong>{paymentId}</strong>
                </span>
              </div>

              {!addressReady && (
                <div className="alert" role="status">
                  <div className="alertTitle">Address incomplete</div>
                  <p style={{ marginBottom: 0 }}>Please fill required address fields before placing the order.</p>
                </div>
              )}
            </>
          )}

          {placeOrderError && (
            <div className="alert" role="status" style={{ marginTop: "0.75rem" }}>
              <div className="alertTitle">Order failed</div>
              <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{placeOrderError}</p>
              {showDeveloperDetails && (
                <p className="muted" style={{ margin: "0.5rem 0 0 0" }}>
                  Please review your details and try again. If auth is required, set <code>VITE_DEV_BEARER_TOKEN</code>.
                </p>
              )}
            </div>
          )}

          {showDeveloperDetails && debugOrderPayload && (
            <details style={{ marginTop: "0.75rem" }} open>
              <summary className="muted">Order API response (debug)</summary>
              <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                {typeof debugOrderPayload === "string" ? debugOrderPayload : JSON.stringify(debugOrderPayload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
