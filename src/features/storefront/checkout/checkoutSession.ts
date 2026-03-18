import { safeGetItem, safeParseJson, safeRemoveItem, safeSetItem, safeWriteJson } from "../../../shared/session/localStorage";

const CHECKOUT_PAYMENT_METHOD_ID_KEY = "shopizer.checkout.paymentMethodId.v1";
const CHECKOUT_LAST_ORDER_RESULT_KEY = "shopizer.checkout.lastOrderResult.v1";

/**
 * Lightweight local (dev-only) order history fallback.
 *
 * Why this exists:
 * - The real order-service endpoints are secured (JWT) and may be unavailable in some dev environments.
 * - The storefront currently uses a dev/guest identity (persisted UUID) and can still provide basic UX
 *   by persisting successful checkout results locally per (storeId, customerId).
 */
const CHECKOUT_ORDER_HISTORY_KEY = "shopizer.checkout.orderHistory.v1";

export type CheckoutOrderResult =
  | {
      ok: true;
      placedAt: string;
      /** Raw backend response body (schema varies by phase). */
      order: unknown;
    }
  | {
      ok: false;
      placedAt: string;
      error: string;
      /** Optional raw body for debugging. */
      order?: unknown;
    };

export type LocalOrderHistoryEntry = {
  /** Best-effort order identifier (backend id/reference if present; otherwise a deterministic local id). */
  id: string;
  placedAt: string;
  storeId: string;
  customerId: string;
  currency?: string;
  /** Raw response payload saved for order detail fallback UI. */
  rawOrder: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

// PUBLIC_INTERFACE
export function extractOrderIdFromUnknownOrder(order: unknown): string | null {
  /**
   * Best-effort extraction across likely DTO shapes (legacy/modern/custom checkout).
   * Used for linking to order detail pages even when backend schema is not finalized.
   */
  if (!isRecord(order)) return null;

  const candidates = ["id", "orderId", "uuid", "reference", "code", "number"];
  for (const k of candidates) {
    const val = order[k];
    if (typeof val === "string" && val.trim()) return val.trim();
    if (typeof val === "number") return String(val);
  }

  // Some APIs nest the order under { order: {...} }
  const nested = order["order"];
  if (nested && isRecord(nested)) return extractOrderIdFromUnknownOrder(nested);

  return null;
}

function readHistoryRaw(): LocalOrderHistoryEntry[] {
  const raw = safeGetItem(CHECKOUT_ORDER_HISTORY_KEY);
  if (!raw) return [];
  const parsed = safeParseJson<unknown>(raw);
  if (!Array.isArray(parsed)) return [];
  // Keep validation light; UI can handle unknown shapes.
  return parsed as LocalOrderHistoryEntry[];
}

function writeHistory(entries: LocalOrderHistoryEntry[]) {
  safeWriteJson(CHECKOUT_ORDER_HISTORY_KEY, entries);
}

// PUBLIC_INTERFACE
export function getLocalOrderHistory(input: { storeId: string; customerId: string }): LocalOrderHistoryEntry[] {
  /** Returns local order history entries scoped to the current dev identity (storeId + customerId). */
  const all = readHistoryRaw();
  return all
    .filter((e) => e && e.storeId === input.storeId && e.customerId === input.customerId)
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : a.placedAt > b.placedAt ? -1 : 0));
}

// PUBLIC_INTERFACE
export function getLocalOrderById(input: {
  storeId: string;
  customerId: string;
  orderId: string;
}): LocalOrderHistoryEntry | null {
  /** Finds a local history entry by id, scoped to (storeId, customerId). */
  const list = getLocalOrderHistory({ storeId: input.storeId, customerId: input.customerId });
  const id = input.orderId.trim();
  return list.find((e) => e.id === id) ?? null;
}

// PUBLIC_INTERFACE
export function recordSuccessfulOrderToLocalHistory(input: {
  placedAt: string;
  storeId: string;
  customerId: string;
  currency?: string;
  rawOrder: unknown;
}): LocalOrderHistoryEntry {
  /**
   * Appends a successful checkout result to local history.
   * Safe to call even if backend order APIs are enabled (provides offline UX / fallback).
   */
  const extracted = extractOrderIdFromUnknownOrder(input.rawOrder);
  const id = extracted ?? `local-${input.placedAt}`;

  const entry: LocalOrderHistoryEntry = {
    id,
    placedAt: input.placedAt,
    storeId: input.storeId,
    customerId: input.customerId,
    currency: input.currency,
    rawOrder: input.rawOrder,
  };

  const prev = readHistoryRaw();
  // De-dupe by id (keep most recent copy).
  const next = [entry, ...prev.filter((e) => e?.id !== entry.id)];
  writeHistory(next);

  return entry;
}

// PUBLIC_INTERFACE
export function getCheckoutPaymentMethodId(): string | null {
  /** Returns the last-selected checkout payment method id (placeholder), if stored. */
  const v = safeGetItem(CHECKOUT_PAYMENT_METHOD_ID_KEY);
  return v && v.trim() ? v.trim() : null;
}

// PUBLIC_INTERFACE
export function setCheckoutPaymentMethodId(paymentMethodId: string) {
  /** Persist the selected checkout payment method id (placeholder). */
  const v = paymentMethodId.trim();
  if (!v) return;
  safeSetItem(CHECKOUT_PAYMENT_METHOD_ID_KEY, v);
}

// PUBLIC_INTERFACE
export function clearCheckoutPaymentMethodId() {
  /** Clears the stored checkout payment method id. */
  safeRemoveItem(CHECKOUT_PAYMENT_METHOD_ID_KEY);
}

// PUBLIC_INTERFACE
export function setLastCheckoutOrderResult(result: CheckoutOrderResult) {
  /** Persists the last order placement result so confirmation page can render after refresh. */
  safeWriteJson(CHECKOUT_LAST_ORDER_RESULT_KEY, result);
}

// PUBLIC_INTERFACE
export function getLastCheckoutOrderResult(): CheckoutOrderResult | null {
  /** Loads the last stored order placement result (if any). */
  const raw = safeGetItem(CHECKOUT_LAST_ORDER_RESULT_KEY);
  if (!raw) return null;

  const parsed = safeParseJson<CheckoutOrderResult>(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof (parsed as { ok?: unknown }).ok !== "boolean") return null;

  return parsed;
}

// PUBLIC_INTERFACE
export function clearLastCheckoutOrderResult() {
  /** Clears the stored last order placement result. */
  safeRemoveItem(CHECKOUT_LAST_ORDER_RESULT_KEY);
}
