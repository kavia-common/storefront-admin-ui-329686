export type LocalCartItem = {
  productId: string; // UUID
  sku?: string;
  quantity: number;
};

export type LocalCart = {
  currency: string;
  items: LocalCartItem[];
  updatedAt: string; // ISO
};

const LOCAL_CART_KEY = "shopizer.localCart.v1";

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function safeGet(): string | null {
  try {
    return window.localStorage.getItem(LOCAL_CART_KEY);
  } catch {
    return null;
  }
}

function safeSet(text: string) {
  try {
    window.localStorage.setItem(LOCAL_CART_KEY, text);
  } catch {
    // ignore storage failures
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

// PUBLIC_INTERFACE
export function getLocalCart(): LocalCart {
  /** Loads the local cart state from localStorage (fallback cart for preview). */
  const raw = safeGet();
  if (!raw) {
    return { currency: "USD", items: [], updatedAt: nowIso() };
  }

  const parsed = safeParseJson<LocalCart>(raw);
  if (!parsed || !Array.isArray(parsed.items) || typeof parsed.currency !== "string") {
    return { currency: "USD", items: [], updatedAt: nowIso() };
  }

  return {
    currency: parsed.currency || "USD",
    items: parsed.items
      .filter((i) => i && typeof i.productId === "string" && typeof i.quantity === "number")
      .map((i) => ({
        productId: i.productId,
        sku: typeof i.sku === "string" ? i.sku : undefined,
        quantity: Math.max(0, Math.floor(i.quantity)),
      }))
      .filter((i) => i.quantity > 0),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
  };
}

// PUBLIC_INTERFACE
export function saveLocalCart(cart: LocalCart) {
  /** Persists the local cart state. */
  const normalized: LocalCart = {
    currency: cart.currency || "USD",
    updatedAt: nowIso(),
    items: (cart.items ?? [])
      .map((i) => ({
        productId: i.productId,
        sku: i.sku,
        quantity: Math.max(0, Math.floor(i.quantity)),
      }))
      .filter((i) => i.productId && i.quantity > 0),
  };

  safeSet(JSON.stringify(normalized));
}

// PUBLIC_INTERFACE
export function clearLocalCart() {
  /** Clears local cart. */
  saveLocalCart({ currency: "USD", items: [], updatedAt: nowIso() });
}

// PUBLIC_INTERFACE
export function addLocalItem(input: { productId: string; sku?: string; quantity: number }) {
  /** Adds quantity for a product in local cart (increments if exists). */
  const cart = getLocalCart();
  const qty = Math.max(1, Math.floor(input.quantity));

  const idx = cart.items.findIndex((i) => i.productId === input.productId);
  if (idx >= 0) {
    cart.items[idx] = {
      ...cart.items[idx],
      sku: cart.items[idx].sku ?? input.sku,
      quantity: cart.items[idx].quantity + qty,
    };
  } else {
    cart.items.push({ productId: input.productId, sku: input.sku, quantity: qty });
  }

  saveLocalCart(cart);
  return cart;
}

// PUBLIC_INTERFACE
export function setLocalItemQuantity(input: { productId: string; quantity: number }) {
  /** Sets quantity for a product in local cart (0 removes). */
  const cart = getLocalCart();
  const qty = Math.max(0, Math.floor(input.quantity));

  if (qty === 0) {
    cart.items = cart.items.filter((i) => i.productId !== input.productId);
  } else {
    const idx = cart.items.findIndex((i) => i.productId === input.productId);
    if (idx >= 0) cart.items[idx] = { ...cart.items[idx], quantity: qty };
    else cart.items.push({ productId: input.productId, quantity: qty });
  }

  saveLocalCart(cart);
  return cart;
}

// PUBLIC_INTERFACE
export function removeLocalItem(input: { productId: string }) {
  /** Removes a product from local cart. */
  const cart = getLocalCart();
  cart.items = cart.items.filter((i) => i.productId !== input.productId);
  saveLocalCart(cart);
  return cart;
}
