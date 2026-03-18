import type { ApiResponse } from "./httpClient";
import type { ApiLogger } from "./httpClient";
import { createHttpClient, parseJson } from "./httpClient";
import { getApiRequestContext, getOrCreateStoreId } from "../shared/session/storeSession";

export type ActuatorHealthPayload = Record<string, unknown>;

export interface ActuatorHealthResult {
  ok: boolean;
  status: number;
  bodyText: string;
  /**
   * When content-type is JSON and parsing succeeds, this may be populated.
   * Keep optional because actuator implementations can vary.
   */
  json?: ActuatorHealthPayload;
  /**
   * When request fails, includes a human-readable error message.
   */
  error?: string;
  /**
   * Resolved request URL (useful for debugging basePath/proxy issues).
   */
  url?: string;
}

export interface CategoryDescription {
  language?: string;
  name?: string;
  friendlyUrl?: string;
  title?: string;
  description?: string | null;
}

export interface CategoryNode {
  /**
   * Category id is backend-dependent:
   * - Legacy Shopizer often uses numeric ids
   * - Shopizer Modern uses UUID strings
   */
  id?: number | string;
  code?: string;
  sortOrder?: number;
  visible?: boolean;
  featured?: boolean;

  lineage?: string | null;
  depth?: number;

  /**
   * Some endpoints return a flattened "description" object, others return "descriptions".
   * We support both and pick a best-effort name at the UI layer.
   */
  description?: CategoryDescription;
  descriptions?: CategoryDescription[];

  /**
   * Category tree.
   */
  children?: CategoryNode[];

  /**
   * Optional extra fields sometimes present.
   */
  productCount?: number;
  store?: string;

  /**
   * Parent is sometimes returned as an object; sometimes null/undefined.
   */
  parent?: unknown;
}

export interface CategoryTreeResult {
  ok: boolean;
  status: number;
  bodyText: string;
  categories: CategoryNode[];
  error?: string;
  url?: string;
}

export interface CategoryByIdResult {
  ok: boolean;
  status: number;
  bodyText: string;
  category?: CategoryNode;
  error?: string;
  url?: string;
}

/**
 * Catalog-service DTO (serialized JSON).
 * See: shopizer-modern-java21/catalog-service ProductSummaryResponse
 */
export interface ProductSummaryResponse {
  id: string; // UUID
  merchantStoreId: string; // UUID
  sku: string;
  type: string;
  available: boolean;
  createdAt: string; // Instant
  updatedAt: string; // Instant
}

/**
 * Catalog-service DTO (serialized JSON).
 * See: shopizer-modern-java21/catalog-service ProductDetailResponse
 */
export interface ProductDetailResponse {
  id: string; // UUID
  merchantStoreId: string; // UUID
  sku: string;
  type: string;
  available: boolean;
  descriptions: Array<{
    languageId: string; // UUID
    name: string;
    description: string;
    friendlyUrl: string;
  }>;
  createdAt: string; // Instant
  updatedAt: string; // Instant
}

export interface ProductListResult {
  ok: boolean;
  status: number;
  bodyText: string;
  products: ProductSummaryResponse[];
  page?: {
    number?: number;
    size?: number;
    totalElements?: number;
    totalPages?: number;
  };
  error?: string;
  url?: string;
}

export interface ProductDetailResult {
  ok: boolean;
  status: number;
  bodyText: string;
  product?: ProductDetailResponse;
  error?: string;
  url?: string;
}

/** cart-service DTO (serialized JSON). */
export interface CartItemResponse {
  id: string; // UUID
  productId: string; // UUID
  quantity: number;
  createdAt: string; // Instant
  updatedAt: string; // Instant
}

/** cart-service DTO (serialized JSON). */
export interface CartResponse {
  id: string; // UUID
  merchantStoreId: string; // UUID
  customerId: string; // UUID
  currency: string;
  status: string;
  createdAt: string; // Instant
  updatedAt: string; // Instant
  items: CartItemResponse[];
}

export interface CartApiResult {
  ok: boolean;
  status: number;
  bodyText: string;
  cart?: CartResponse;
  error?: string;
  url?: string;
}

export interface CheckoutApiResult {
  ok: boolean;
  status: number;
  bodyText: string;
  /** Parsed JSON when possible (schema varies by phase). */
  json?: unknown;
  error?: string;
  url?: string;
}

/** shipping-service DTO (serialized JSON). Mirrors shipping-service QuoteRequest/QuoteResponse. */
export interface ShippingQuoteRequest {
  destination: { country: string; postalCode?: string; region?: string };
  currency: string;
  items: Array<{ sku: string; quantity: number; weightGrams: number }>;
}

/** shipping-service DTO (serialized JSON). */
export interface ShippingQuoteResponse {
  requestId: string;
  quotedAt: string;
  currency: string;
  quotes: Array<{
    provider: string;
    serviceLevel: string;
    serviceName: string;
    amount: number;
  }>;
}

export interface ShippingQuotesApiResult {
  ok: boolean;
  status: number;
  bodyText: string;
  quotes?: ShippingQuoteResponse;
  error?: string;
  url?: string;
}

/** order-service DTOs (serialized JSON). Mirrors shopizer-modern-java21/order-service OrderResponse. */
export interface OrderItemResponse {
  id: string; // UUID
  productId: string; // UUID
  quantity: number;
  unitAmount: number; // minor currency units
}

/** order-service DTO (serialized JSON). */
export interface OrderResponse {
  id: string; // UUID
  merchantStoreId: string; // UUID
  customerId: string; // UUID
  currency: string;
  status: string;
  paymentStatus: string;
  totalAmount: number; // minor currency units
  createdAt: string; // Instant
  updatedAt: string; // Instant
  items: OrderItemResponse[];
}

export interface OrderListApiResult {
  ok: boolean;
  status: number;
  bodyText: string;
  orders: OrderResponse[];
  error?: string;
  url?: string;
}

export interface OrderDetailApiResult {
  ok: boolean;
  status: number;
  bodyText: string;
  order?: OrderResponse;
  error?: string;
  url?: string;
}

type SpringPage<T> = {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

type ModernCategoryResponse = {
  id: string; // UUID
  merchantStoreId: string; // UUID
  code?: string | null;
  sortOrder?: number;
  visible?: boolean;
  parentId?: string | null;
  descriptions?: Array<{
    languageId?: string;
    name?: string | null;
    description?: string | null;
    friendlyUrl?: string | null;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asSpringPage<T>(payload: unknown): SpringPage<T> | null {
  if (!isRecord(payload)) return null;
  if (!Array.isArray(payload.content)) return null;
  return payload as SpringPage<T>;
}

function toCategoryDescriptionFromModern(
  d: ModernCategoryResponse["descriptions"][number],
): CategoryDescription {
  return {
    // We don't have legacy language codes here; keep optional.
    name: d.name ?? undefined,
    friendlyUrl: d.friendlyUrl ?? undefined,
    description: d.description ?? undefined,
  };
}

function toCategoryNodeFromModern(c: ModernCategoryResponse): CategoryNode {
  const descriptions = (c.descriptions ?? []).map(toCategoryDescriptionFromModern);
  return {
    id: c.id,
    code: c.code ?? undefined,
    sortOrder: c.sortOrder,
    visible: c.visible,
    descriptions,
    description: descriptions[0],
    children: [],
    parent: c.parentId ?? undefined,
    store: c.merchantStoreId,
  };
}

function buildTreeFromModernCategories(flat: ModernCategoryResponse[]): CategoryNode[] {
  // Convert to nodes + stitch children based on parentId.
  const nodesById = new Map<string, CategoryNode>();
  const parentById = new Map<string, string | null | undefined>();

  for (const c of flat) {
    nodesById.set(c.id, toCategoryNodeFromModern(c));
    parentById.set(c.id, c.parentId ?? null);
  }

  const roots: CategoryNode[] = [];

  for (const [id, node] of nodesById.entries()) {
    const parentId = parentById.get(id);
    if (!parentId) {
      roots.push(node);
      continue;
    }

    const parent = nodesById.get(parentId);
    if (!parent) {
      // Parent missing in page => treat as root to avoid losing data.
      roots.push(node);
      continue;
    }

    if (!Array.isArray(parent.children)) parent.children = [];
    parent.children.push(node);
  }

  // Deterministic ordering (best-effort) to keep UI stable.
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    for (const n of nodes) {
      if (Array.isArray(n.children) && n.children.length > 0) sortRec(n.children);
    }
  };
  sortRec(roots);

  return roots;
}

function normalizeStoreIdErrorMessage(kind: "categories" | "products"): string {
  if (kind === "categories") {
    return (
      "No store UUID configured for category loading. " +
      "Set VITE_DEFAULT_STORE_ID (or pass { storeId }) so the UI can call " +
      "GET /api/v1/catalog/stores/{storeUuid}/categories."
    );
  }

  return (
    "No store UUID configured for product loading. " +
    "Set VITE_DEFAULT_STORE_ID (or pass { storeId }) so the UI can call " +
    "GET /api/v1/catalog/stores/{storeUuid}/products and " +
    "GET /api/v1/catalog/stores/{storeUuid}/products/{sku}."
  );
}

// PUBLIC_INTERFACE
export function createShopizerApi(params: {
  basePath: string;
  logger?: ApiLogger;
  /**
   * Optional default store UUID for Shopizer Modern endpoints.
   * If provided, category/product loading will prefer the modern endpoint family:
   *   GET /api/v1/catalog/stores/{storeId}/...
   */
  defaultStoreId?: string;
}) {
  /**
   * Shopizer API module.
   *
   * This is the "backend connection layer" for the UI:
   * - It translates UI use-cases into concrete endpoint calls.
   * - It keeps endpoint paths centralized and searchable.
   */
  const http = createHttpClient({
    basePath: params.basePath,
    logger: params.logger,
    contextProvider: () => getApiRequestContext({ fallbackStoreId: params.defaultStoreId }),
  });

  async function getActuatorHealth(): Promise<ActuatorHealthResult> {
    const operation = "system.getActuatorHealth";
    const response: ApiResponse<string> = await http.request<string>({
      operation,
      method: "GET",
      path: "/actuator/health",
      headers: { Accept: "application/json" },
      // Keep as text so UI can display raw body even if JSON varies.
      parse: ({ text }) => text,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        bodyText: response.text,
        error: response.error.message,
        url: response.url,
      };
    }

    // Best-effort JSON parse for convenience (without making UI depend on schema).
    let json: ActuatorHealthPayload | undefined;
    try {
      json = response.text ? (JSON.parse(response.text) as ActuatorHealthPayload) : undefined;
    } catch {
      json = undefined;
    }

    return {
      ok: true,
      status: response.status,
      bodyText: response.text,
      json,
      url: response.url,
    };
  }

  async function getCategoryTree(input?: {
    /**
     * Shopizer Modern store id (UUID). Required for the modern catalog endpoint.
     * If omitted, the API client will fall back to `defaultStoreId` configured in `createShopizerApi`.
     */
    storeId?: string;
    signal?: AbortSignal;
  }): Promise<CategoryTreeResult> {
    const operation = "catalog.getCategoryTree";

    const storeId = input?.storeId ?? getOrCreateStoreId(params.defaultStoreId);

    if (!storeId) {
      return {
        ok: false,
        status: 0,
        bodyText: "",
        categories: [],
        url: undefined,
        error: normalizeStoreIdErrorMessage("categories"),
      };
    }

    // Modern (only): GET /api/v1/catalog/stores/{storeUuid}/categories?page=0&size=...
    // Note: UI basePath defaults to "/api", so this uses "/api/v1/..." at runtime.
    const response: ApiResponse<unknown> = await http.request<unknown>({
      operation,
      method: "GET",
      path: `/v1/catalog/stores/${storeId}/categories`,
      query: { page: 0, size: 200 },
      headers: { Accept: "application/json" },
      parse: parseJson<unknown>(),
      signal: input?.signal,
    });

    if (response.ok) {
      const page = asSpringPage<ModernCategoryResponse>(response.data);
      const flat = page?.content ?? [];
      const categories = buildTreeFromModernCategories(flat);
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        categories,
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: Ensure the gateway routes /api/v1/catalog/** to the catalog service, and that VITE_DEFAULT_STORE_ID matches an existing store UUID."
        : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      categories: [],
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  async function getCategoryById(input: {
    /**
     * Category id (UUID string).
     * This is end-to-end integrated via the gateway preview family:
     *   GET /api/__preview/catalog/stores/{storeId}/categories/{categoryId}
     *
     * Contract:
     * - Inputs: categoryId (required), optional storeId override, optional AbortSignal
     * - Output: CategoryByIdResult containing CategoryNode on success
     * - Errors: never throws; returns ok=false with rich context + truncated body
     * - Side effects: performs a network request through the canonical http client
     */
    categoryId: string;
    storeId?: string;
    signal?: AbortSignal;
  }): Promise<CategoryByIdResult> {
    const operation = "catalog.getCategoryById";
    const storeId = input.storeId ?? getOrCreateStoreId(params.defaultStoreId);
    const categoryId = input.categoryId?.trim();

    if (!storeId) {
      return {
        ok: false,
        status: 0,
        bodyText: "",
        category: undefined,
        url: undefined,
        error: normalizeStoreIdErrorMessage("categories"),
      };
    }

    if (!categoryId) {
      return {
        ok: false,
        status: 0,
        bodyText: "",
        category: undefined,
        url: undefined,
        error: "Missing required categoryId.",
      };
    }

    // IMPORTANT:
    // The work item requires category-by-id to be non-stubbed for the modernized flow.
    // We keep the other catalog endpoints as preview stubs (as requested), but this
    // call is wired end-to-end through the gateway route.
    const safeCategoryId = encodeURIComponent(categoryId);

    const response: ApiResponse<ModernCategoryResponse> = await http.request<ModernCategoryResponse>({
      operation,
      method: "GET",
      path: `/__preview/catalog/stores/${storeId}/categories/${safeCategoryId}`,
      headers: { Accept: "application/json" },
      parse: parseJson<ModernCategoryResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        category: toCategoryNodeFromModern(response.data),
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: 404 can mean the categoryId doesn't exist for this store, or the gateway preview route isn't available."
        : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      category: undefined,
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  async function listProducts(input?: {
    storeId?: string;
    page?: number;
    size?: number;
    signal?: AbortSignal;
  }): Promise<ProductListResult> {
    const operation = "catalog.listProducts";
    const storeId = input?.storeId ?? params.defaultStoreId;

    if (!storeId) {
      return {
        ok: false,
        status: 0,
        bodyText: "",
        products: [],
        error: normalizeStoreIdErrorMessage("products"),
      };
    }

    const response: ApiResponse<unknown> = await http.request<unknown>({
      operation,
      method: "GET",
      path: `/v1/catalog/stores/${storeId}/products`,
      query: { page: input?.page ?? 0, size: input?.size ?? 20 },
      headers: { Accept: "application/json" },
      parse: parseJson<unknown>(),
      signal: input?.signal,
    });

    if (response.ok) {
      const page = asSpringPage<ProductSummaryResponse>(response.data);
      const products = page?.content ?? [];

      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        products,
        page: {
          number: page?.number,
          size: page?.size,
          totalElements: page?.totalElements,
          totalPages: page?.totalPages,
        },
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: Ensure the gateway routes /api/v1/catalog/** to the catalog service, and that VITE_DEFAULT_STORE_ID matches an existing store UUID."
        : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      products: [],
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  async function getProductBySku(input: {
    sku: string;
    storeId?: string;
    signal?: AbortSignal;
  }): Promise<ProductDetailResult> {
    const operation = "catalog.getProductBySku";
    const storeId = input.storeId ?? getOrCreateStoreId(params.defaultStoreId);

    if (!storeId) {
      return {
        ok: false,
        status: 0,
        bodyText: "",
        product: undefined,
        error: normalizeStoreIdErrorMessage("products"),
      };
    }

    const safeSku = encodeURIComponent(input.sku);
    const response: ApiResponse<ProductDetailResponse> = await http.request<ProductDetailResponse>({
      operation,
      method: "GET",
      path: `/v1/catalog/stores/${storeId}/products/${safeSku}`,
      headers: { Accept: "application/json" },
      parse: parseJson<ProductDetailResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        product: response.data,
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: A 404 can mean the SKU does not exist for the configured store, or the gateway is not routing /api/v1/catalog/** correctly."
        : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      product: undefined,
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  function normalizeBearer(token: string | undefined): string | undefined {
    if (!token) return undefined;
    const t = token.trim();
    if (!t) return undefined;
    return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
  }

  async function getOrCreateActiveCart(input: {
    merchantStoreId: string;
    customerId: string;
    currency: string;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CartApiResult> {
    const operation = "cart.getOrCreateActiveCart";
    const response: ApiResponse<CartResponse> = await http.request<CartResponse>({
      operation,
      method: "POST",
      path: "/v1/carts/active",
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      body: {
        merchantStoreId: input.merchantStoreId,
        customerId: input.customerId,
        currency: input.currency,
      },
      parse: parseJson<CartResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, cart: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      cart: undefined,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function getCart(input: {
    cartId: string;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CartApiResult> {
    const operation = "cart.getCart";
    const safeCartId = encodeURIComponent(input.cartId);
    const response: ApiResponse<CartResponse> = await http.request<CartResponse>({
      operation,
      method: "GET",
      path: `/v1/carts/${safeCartId}`,
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      parse: parseJson<CartResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, cart: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      cart: undefined,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function addItem(input: {
    cartId: string;
    productId: string;
    quantity: number;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CartApiResult> {
    const operation = "cart.addItem";
    const safeCartId = encodeURIComponent(input.cartId);
    const response: ApiResponse<CartResponse> = await http.request<CartResponse>({
      operation,
      method: "POST",
      path: `/v1/carts/${safeCartId}/items`,
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      body: { productId: input.productId, quantity: input.quantity },
      parse: parseJson<CartResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, cart: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      cart: undefined,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function setItemQuantity(input: {
    cartId: string;
    productId: string;
    quantity: number;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CartApiResult> {
    const operation = "cart.setItemQuantity";
    const safeCartId = encodeURIComponent(input.cartId);
    const response: ApiResponse<CartResponse> = await http.request<CartResponse>({
      operation,
      method: "PUT",
      path: `/v1/carts/${safeCartId}/items`,
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      body: { productId: input.productId, quantity: input.quantity },
      parse: parseJson<CartResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, cart: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      cart: undefined,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function removeItem(input: {
    cartId: string;
    productId: string;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CartApiResult> {
    const operation = "cart.removeItem";
    const safeCartId = encodeURIComponent(input.cartId);
    const safeProductId = encodeURIComponent(input.productId);
    const response: ApiResponse<CartResponse> = await http.request<CartResponse>({
      operation,
      method: "DELETE",
      path: `/v1/carts/${safeCartId}/items/${safeProductId}`,
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      parse: parseJson<CartResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, cart: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      cart: undefined,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function createOrderFromCart(input: {
    cartId: string;
    merchantStoreId: string;
    customerId: string;
    /**
     * UI-selected payment method (placeholder).
     * Note: backend Phase 1 may ignore/override this value (e.g., always authorizes PayPal).
     */
    paymentMethod?: string;
    destination: { country: string; postalCode?: string; region?: string };
    storeCode?: string;
    couponCode?: string;
    selectedShippingQuote?: { provider: string; serviceLevel: string };
    defaultItemWeightGrams?: number;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<CheckoutApiResult> {
    const operation = "checkout.createOrderFromCart";
    const response: ApiResponse<unknown> = await http.request<unknown>({
      operation,
      method: "POST",
      path: "/checkout/orders",
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      body: {
        cartId: input.cartId,
        merchantStoreId: input.merchantStoreId,
        customerId: input.customerId,
        paymentMethod: input.paymentMethod,
        storeCode: input.storeCode,
        couponCode: input.couponCode,
        destination: input.destination,
        selectedShippingQuote: input.selectedShippingQuote,
        defaultItemWeightGrams: input.defaultItemWeightGrams,
      },
      // Keep as JSON (unknown) so UI can show it as pretty JSON.
      parse: parseJson<unknown>(),
      signal: input.signal,
    });

    if (response.ok) {
      return { ok: true, status: response.status, bodyText: response.text, json: response.data, url: response.url };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      url: response.url,
      error:
        `${response.error.message}` + (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : ""),
    };
  }

  async function listOrders(input: {
    merchantStoreId: string;
    customerId: string;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<OrderListApiResult> {
    const operation = "orders.listOrders";

    // order-service is mounted at /api/orders in the gateway. Since frontend basePath defaults to "/api",
    // this becomes a request to: GET /api/orders?merchantStoreId=...&customerId=...
    const response: ApiResponse<OrderResponse[]> = await http.request<OrderResponse[]>({
      operation,
      method: "GET",
      path: "/orders",
      query: { merchantStoreId: input.merchantStoreId, customerId: input.customerId },
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      parse: parseJson<OrderResponse[]>(),
      signal: input.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        orders: Array.isArray(response.data) ? response.data : [],
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: The orders endpoint is expected at GET /api/orders. Ensure the gateway routes /api/orders/** to order-service."
        : response.status === 401
          ? "\n\nHint: order-service is secured. Set VITE_DEV_BEARER_TOKEN to a valid JWT (Keycloak-issued) to enable order history."
          : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      orders: [],
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  async function getOrder(input: {
    orderId: string;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<OrderDetailApiResult> {
    const operation = "orders.getOrder";
    const safeOrderId = encodeURIComponent(input.orderId);

    const response: ApiResponse<OrderResponse> = await http.request<OrderResponse>({
      operation,
      method: "GET",
      path: `/orders/${safeOrderId}`,
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      parse: parseJson<OrderResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        order: response.data,
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: A 404 may mean the order id is invalid for this environment, or /api/orders is not routed to order-service."
        : response.status === 401
          ? "\n\nHint: order-service is secured. Set VITE_DEV_BEARER_TOKEN to a valid JWT (Keycloak-issued) to view order details."
          : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      order: undefined,
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  // PUBLIC_INTERFACE
  async function getShippingQuotes(input: {
    request: ShippingQuoteRequest;
    signal?: AbortSignal;
    bearerToken?: string;
  }): Promise<ShippingQuotesApiResult> {
    /** Calls shipping-service: POST /api/shipping/quotes (frontend path: "/shipping/quotes"). */
    const operation = "shipping.getQuotes";

    const response: ApiResponse<ShippingQuoteResponse> = await http.request<ShippingQuoteResponse>({
      operation,
      method: "POST",
      path: "/shipping/quotes",
      headers: {
        Accept: "application/json",
        ...(normalizeBearer(input.bearerToken) ? { Authorization: normalizeBearer(input.bearerToken)! } : {}),
      },
      body: input.request,
      parse: parseJson<ShippingQuoteResponse>(),
      signal: input.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        bodyText: response.text,
        quotes: response.data,
        url: response.url,
      };
    }

    const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
    const hint =
      response.status === 404
        ? "\n\nHint: The shipping quote endpoint is expected at POST /api/shipping/quotes. Ensure the gateway routes /api/shipping/** to shipping-service."
        : "";

    return {
      ok: false,
      status: response.status,
      bodyText: response.text,
      quotes: undefined,
      url: response.url,
      error:
        `${response.error.message}` +
        (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
        hint,
    };
  }

  return {
    system: {
      getActuatorHealth,
    },
    catalog: {
      getCategoryTree,
      getCategoryById,
      listProducts,
      getProductBySku,
    },
    cart: {
      getOrCreateActiveCart,
      getCart,
      addItem,
      setItemQuantity,
      removeItem,
    },
    orders: {
      listOrders,
      getOrder,
    },
    shipping: {
      getQuotes: getShippingQuotes,
    },
    checkout: {
      createOrderFromCart,
    },
  };
}
