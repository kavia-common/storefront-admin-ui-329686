import { useCallback, useEffect, useMemo, useState } from "react";
import { shopizerApi } from "../../../api";
import { clearBackendCartId, getBackendCartId, setBackendCartId } from "./cartSession";
import { addLocalItem, clearLocalCart, getLocalCart, removeLocalItem, setLocalItemQuantity } from "./localCart";
import type { CartResponse } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

export type CartMode = "backend" | "local";

export type CartLine = {
  productId: string;
  sku?: string;
  quantity: number;
};

export type CartView = {
  mode: CartMode;
  currency: string;
  cartId?: string;
  items: CartLine[];
};



function toCartViewFromBackend(cart: CartResponse): CartView {
  return {
    mode: "backend",
    currency: cart.currency,
    cartId: cart.id,
    items: (cart.items ?? []).map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    })),
  };
}

function toCartViewFromLocal(): CartView {
  const local = getLocalCart();
  return {
    mode: "local",
    currency: local.currency || "USD",
    cartId: undefined,
    items: local.items.map((i) => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
  };
}

function mergeSkusIntoBackendCart(view: CartView): CartView {
  // Backend cart doesn't include SKU in the DTO, so we merge SKU hints from local cart if present
  // (useful for "View product" links in the UI).
  if (view.mode !== "backend") return view;

  const skuByProductId = new Map<string, string>();
  for (const i of getLocalCart().items) {
    if (i.sku) skuByProductId.set(i.productId, i.sku);
  }

  return {
    ...view,
    items: view.items.map((i) => ({ ...i, sku: i.sku ?? skuByProductId.get(i.productId) })),
  };
}

// PUBLIC_INTERFACE
export function useCart() {
  /** Cart state hook used by Products/ProductDetail/Cart pages. Tries backend cart-service and falls back to local cart. */
  const {
    state: { storeId, customerId, currency },
    derived: { bearerToken },
  } = useStoreSession();

  const [cart, setCart] = useState<CartView>(() => toCartViewFromLocal());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalItems = useMemo(() => cart.items.reduce((sum, i) => sum + i.quantity, 0), [cart.items]);

  const refresh = useCallback(
    async (options?: { forceBackend?: boolean; forceLocal?: boolean }) => {
      setLoading(true);
      setError(null);

      if (options?.forceLocal) {
        setCart(toCartViewFromLocal());
        setLoading(false);
        return;
      }

      const token = bearerToken;
      const merchantStoreId = storeId;

      // If a backend cart id is stored, try to load it first.
      const storedCartId = getBackendCartId();
      if (storedCartId && !options?.forceLocal) {
        const r = await shopizerApi.cart.getCart({ cartId: storedCartId, bearerToken: token });
        if (r.ok && r.cart) {
          setCart(mergeSkusIntoBackendCart(toCartViewFromBackend(r.cart)));
          setLoading(false);
          return;
        }

        // If backend cart disappeared/unauthorized, drop it and fall back.
        clearBackendCartId();
        if (options?.forceBackend) {
          setError(r.error ?? "Failed to load backend cart");
        }
      }

      // Try to create/get active backend cart (unless explicitly forcing local).
      if (!options?.forceLocal) {
        const r = await shopizerApi.cart.getOrCreateActiveCart({
          merchantStoreId,
          customerId,
          currency,
          bearerToken: token,
        });

        if (r.ok && r.cart) {
          setBackendCartId(r.cart.id);
          setCart(mergeSkusIntoBackendCart(toCartViewFromBackend(r.cart)));
          setLoading(false);
          return;
        }

        // Backend not available (preview), use local cart.
        if (options?.forceBackend) {
          setError(r.error ?? "Backend cart unavailable");
        }
      }

      setCart(toCartViewFromLocal());
      setLoading(false);
    },
    [currency, customerId, storeId],
  );

  const addItem = useCallback(async (input: { productId: string; sku?: string; quantity: number }) => {
    setLoading(true);
    setError(null);

    // Always update local SKU hints so cart UI can link to products even for backend mode.
    addLocalItem({ productId: input.productId, sku: input.sku, quantity: Math.max(1, Math.floor(input.quantity)) });

    const token = bearerToken;
    const storedCartId = getBackendCartId();

    // Prefer backend if we already have a backend cart id; otherwise do a refresh (which will try backend then local).
    if (storedCartId) {
      const r = await shopizerApi.cart.addItem({
        cartId: storedCartId,
        productId: input.productId,
        quantity: Math.max(1, Math.floor(input.quantity)),
        bearerToken: token,
      });

      if (r.ok && r.cart) {
        setCart(mergeSkusIntoBackendCart(toCartViewFromBackend(r.cart)));
        setLoading(false);
        return { ok: true as const, mode: "backend" as const };
      }

      // Backend failed (401/connection/etc) => fall back to local view.
      setError(r.error ?? "Failed to add item to backend cart; using local cart");
      setCart(toCartViewFromLocal());
      setLoading(false);
      return { ok: false as const, mode: "local" as const, error: r.error };
    }

    // No backend cart id: refresh (attempt backend cart), then show whichever mode we end up in.
    await refresh();
    setCart((prev) => prev.mode === "backend" ? prev : toCartViewFromLocal());
    setLoading(false);
    return { ok: true as const, mode: cart.mode };
  }, [cart.mode, refresh]);

  const setQuantity = useCallback(async (input: { productId: string; quantity: number }) => {
    setLoading(true);
    setError(null);

    // Always update local cart (source of truth for fallback).
    setLocalItemQuantity({ productId: input.productId, quantity: input.quantity });

    const bearerToken = normalizeAuthToken();
    const storedCartId = getBackendCartId();

    if (storedCartId) {
      const r = await shopizerApi.cart.setItemQuantity({
        cartId: storedCartId,
        productId: input.productId,
        quantity: Math.max(0, Math.floor(input.quantity)),
        bearerToken: token,
      });

      if (r.ok && r.cart) {
        setCart(mergeSkusIntoBackendCart(toCartViewFromBackend(r.cart)));
        setLoading(false);
        return { ok: true as const, mode: "backend" as const };
      }

      setError(r.error ?? "Failed to update backend cart; using local cart");
      setCart(toCartViewFromLocal());
      setLoading(false);
      return { ok: false as const, mode: "local" as const, error: r.error };
    }

    setCart(toCartViewFromLocal());
    setLoading(false);
    return { ok: true as const, mode: "local" as const };
  }, []);

  const removeItem = useCallback(async (input: { productId: string }) => {
    setLoading(true);
    setError(null);

    removeLocalItem({ productId: input.productId });

    const bearerToken = normalizeAuthToken();
    const storedCartId = getBackendCartId();

    if (storedCartId) {
      const r = await shopizerApi.cart.removeItem({
        cartId: storedCartId,
        productId: input.productId,
        bearerToken: token,
      });

      if (r.ok && r.cart) {
        setCart(mergeSkusIntoBackendCart(toCartViewFromBackend(r.cart)));
        setLoading(false);
        return { ok: true as const, mode: "backend" as const };
      }

      setError(r.error ?? "Failed to update backend cart; using local cart");
      setCart(toCartViewFromLocal());
      setLoading(false);
      return { ok: false as const, mode: "local" as const, error: r.error };
    }

    setCart(toCartViewFromLocal());
    setLoading(false);
    return { ok: true as const, mode: "local" as const };
  }, []);

  const clear = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearLocalCart();
    // We do not attempt to clear backend cart (no endpoint yet in cart-service).
    setCart(toCartViewFromLocal());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, storeId, customerId, currency]);

  return {
    cart,
    loading,
    error,
    totalItems,
    refresh,
    addItem,
    setQuantity,
    removeItem,
    clear,
  };
}
