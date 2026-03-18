import type { ApiResponse } from "./httpClient";
import type { ApiLogger } from "./httpClient";
import { createHttpClient, parseJson } from "./httpClient";

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

function asCategoryNodeArray(payload: unknown): CategoryNode[] {
  // The Shopizer docs show a single object in examples, but in practice this endpoint is
  // often a list (root categories), and sometimes wrapped.
  if (Array.isArray(payload)) return payload as CategoryNode[];

  if (isRecord(payload)) {
    // Some APIs wrap results
    const categories = payload.categories;
    if (Array.isArray(categories)) return categories as CategoryNode[];

    // Some APIs may return a single category root with children
    const hasChildren = Array.isArray(payload.children);
    const hasCodeOrId =
      typeof payload.code === "string" ||
      typeof payload.id === "number" ||
      typeof payload.id === "string";
    if (hasChildren || hasCodeOrId) return [payload as unknown as CategoryNode];
  }

  return [];
}

function asSpringPage<T>(payload: unknown): SpringPage<T> | null {
  if (!isRecord(payload)) return null;
  if (!Array.isArray(payload.content)) return null;
  return payload as SpringPage<T>;
}

function toCategoryDescriptionFromModern(d: ModernCategoryResponse["descriptions"][number]): CategoryDescription {
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

// PUBLIC_INTERFACE
export function createShopizerApi(params: {
  basePath: string;
  logger?: ApiLogger;
  /**
   * Optional default store UUID for Shopizer Modern endpoints.
   * If provided, category loading will prefer the modern endpoint:
   *   GET /api/v1/catalog/stores/{storeId}/categories
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
  const http = createHttpClient({ basePath: params.basePath, logger: params.logger });

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
     * Legacy / compatibility store code. Shopizer docs/examples commonly use DEFAULT.
     * (Used by legacy endpoints that accept store code as query param.)
     */
    store?: string;
    /**
     * Shopizer Modern store id (UUID). Required for modern catalog endpoints.
     */
    storeId?: string;
    /**
     * Optional language hint.
     *
     * Notes:
     * - Legacy Shopizer (sm-shop) exposes list categories at:
     *     GET /services/public/category/{store}/{language}
     * - Some other deployments accept `lang` as query param; we keep supporting that too.
     */
    lang?: string;
    signal?: AbortSignal;
  }): Promise<CategoryTreeResult> {
    const operation = "catalog.getCategoryTree";

    const storeCode = input?.store ?? "DEFAULT";
    const storeId = input?.storeId ?? params.defaultStoreId;
    const lang = input?.lang ?? "en";

    // Graceful handling: deployments may expose different endpoints depending on which backend is
    // running behind the "/api" proxy (legacy Shopizer vs Shopizer Modern services).
    //
    // Strategy:
    // 1) Prefer Shopizer Modern endpoint (if we have a store UUID):
    //      GET /api/v1/catalog/stores/{storeId}/categories
    // 2) Prefer legacy Shopizer (sm-shop) public endpoint:
    //      GET /services/public/category/{store}/{language}
    // 3) Fall back to other legacy-looking endpoints (some gateways expose them).
    const candidates: Array<{
      kind: "modernPaged" | "legacyJson";
      label: string;
      path: string;
      query?: Record<string, string | number | undefined>;
    }> = [];

    if (storeId) {
      candidates.push({
        kind: "modernPaged",
        label: "modern:/v1/catalog/stores/{storeId}/categories",
        path: `/v1/catalog/stores/${storeId}/categories`,
        query: { page: 0, size: 200 },
      });
    }

    // Legacy Shopizer (sm-shop) endpoint for category listing.
    candidates.push({
      kind: "legacyJson",
      label: "legacy:/services/public/category/{store}/{language}",
      path: `/services/public/category/${storeCode}/${lang}`,
    });

    // Other common legacy endpoints (some deployments/gateways expose them).
    candidates.push(
      { kind: "legacyJson", label: "legacy:/v1/categories?store=...", path: "/v1/categories", query: { store: storeCode, lang } },
      { kind: "legacyJson", label: "legacy:/v1/category?store=...", path: "/v1/category", query: { store: storeCode, lang } },
    );

    const attempted: Array<{ label: string; url: string; status: number }> = [];

    let lastFailure:
      | { status: number; url: string; text: string; errorMessage: string }
      | undefined;

    for (const candidate of candidates) {
      const response: ApiResponse<unknown> = await http.request<unknown>({
        operation,
        method: "GET",
        path: candidate.path,
        query: candidate.query,
        headers: { Accept: "application/json" },
        parse: parseJson<unknown>(),
        signal: input?.signal,
      });

      attempted.push({ label: candidate.label, url: response.url, status: response.status });

      if (response.ok) {
        if (candidate.kind === "modernPaged") {
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

        const categories = asCategoryNodeArray(response.data);
        return {
          ok: true,
          status: response.status,
          bodyText: response.text,
          categories,
          url: response.url,
        };
      }

      const responseSnippet = response.text ? response.text.slice(0, 1200) : "";
      const attemptedSummary = attempted
        .map((a) => `${a.status || "ERR"} ${a.url} (${a.label})`)
        .join(" → ");

      lastFailure = {
        status: response.status,
        url: response.url,
        text: response.text,
        errorMessage:
          `${response.error.message}` +
          (responseSnippet ? `\n\nResponse body (truncated):\n${responseSnippet}` : "") +
          (attemptedSummary ? `\n\nAttempted:\n${attemptedSummary}` : ""),
      };

      // Continue trying alternates for common "wrong endpoint/backend" signals.
      // - 404 => endpoint not present
      // - 500/502/503/504 => gateway/backend mismatch or backend failure for that route
      //
      // Fail fast on auth errors since alternates are unlikely to help.
      const shouldTryNext =
        response.status === 404 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 503 ||
        response.status === 504;

      if (!shouldTryNext) break;
    }

    return {
      ok: false,
      status: lastFailure?.status ?? 0,
      bodyText: lastFailure?.text ?? "",
      categories: [],
      error: lastFailure?.errorMessage ?? "Unknown error while loading categories",
      url: lastFailure?.url,
    };
  }

  return {
    system: {
      getActuatorHealth,
    },
    catalog: {
      getCategoryTree,
    },
  };
}
