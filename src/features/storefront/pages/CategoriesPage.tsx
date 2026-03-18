import { useEffect, useMemo, useState } from "react";
import { shopizerApi } from "../../../api";
import type { CategoryNode, CategoryTreeResult } from "../../../api/shopizerApi";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

function getCategoryDisplayName(category: CategoryNode): string {
  return (
    category.description?.name ??
    category.descriptions?.[0]?.name ??
    category.code ??
    (typeof category.id === "number" || typeof category.id === "string" ? `Category ${category.id}` : "Untitled category")
  );
}

function normalizeRoots(categories: CategoryNode[]): CategoryNode[] {
  // If a single root comes back, show its children as the meaningful list
  // (but still handle the "single root without children" case).
  if (categories.length === 1 && Array.isArray(categories[0]?.children) && categories[0].children.length > 0) {
    return categories[0].children;
  }
  return categories;
}

function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const walk = (n: CategoryNode): CategoryNode | null => {
    const name = getCategoryDisplayName(n).toLowerCase();
    const code = (n.code ?? "").toLowerCase();
    const matchesSelf = name.includes(q) || code.includes(q);

    const children = Array.isArray(n.children) ? n.children : [];
    const filteredChildren = children
      .map((c) => walk(c))
      .filter((x): x is CategoryNode => Boolean(x));

    if (matchesSelf || filteredChildren.length > 0) {
      return { ...n, children: filteredChildren };
    }
    return null;
  };

  return nodes.map((n) => walk(n)).filter((x): x is CategoryNode => Boolean(x));
}

function CategoryTreeNodeView(props: { node: CategoryNode; defaultOpen: boolean; showDeveloperDetails: boolean }) {
  const name = getCategoryDisplayName(props.node);
  const countSuffix = typeof props.node.productCount === "number" ? ` · ${props.node.productCount} products` : "";

  const metaPieces = [
    props.showDeveloperDetails && props.node.code ? `code: ${props.node.code}` : null,
    countSuffix ? countSuffix.trim() : null,
  ]
    .filter(Boolean)
    .join(" ");

  const children = Array.isArray(props.node.children) ? props.node.children : [];
  const hasChildren = children.length > 0;

  const id = props.node.id;
  const canLink = typeof id === "string" && id.trim().length > 0;
  const titleEl = canLink ? (
    <a href={`/categories/${encodeURIComponent(id)}`} style={{ textDecoration: "none" }}>
      <strong>{name}</strong>
    </a>
  ) : (
    <strong>{name}</strong>
  );

  if (!hasChildren) {
    return (
      <li>
        <div>
          {titleEl}
          {metaPieces ? (
            <>
              {" "}
              <span className="muted">({metaPieces})</span>
            </>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <li>
      <details open={props.defaultOpen}>
        <summary>
          {titleEl}
          {metaPieces ? (
            <>
              {" "}
              <span className="muted">({metaPieces})</span>
            </>
          ) : null}
        </summary>
        <ul>
          {children.map((c, idx) => (
            <CategoryTreeNodeView
              key={`${c.code ?? c.id ?? "cat"}-${idx}`}
              node={c}
              defaultOpen={props.defaultOpen}
              showDeveloperDetails={props.showDeveloperDetails}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

// PUBLIC_INTERFACE
export function CategoriesPage() {
  /** Storefront categories view: loads category hierarchy from backend and renders a filterable tree with robust empty/error states. */
  const {
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const [result, setResult] = useState<CategoryTreeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      const r = await shopizerApi.catalog.getCategoryTree({ signal: controller.signal });
      setResult(r);
      setLoading(false);
    };

    void load();

    return () => controller.abort();
  }, []);

  const roots = useMemo(() => normalizeRoots(result?.ok ? result.categories : []), [result]);
  const filteredRoots = useMemo(() => filterTree(roots, filter), [roots, filter]);

  const showExpanded = filter.trim().length > 0;

  return (
    <div>
      <div className="pageTitleRow">
        <h1>Categories</h1>
        <span className="badge">Catalog</span>
      </div>

      <p className="pageSubtitle">
        {showDeveloperDetails ? (
          <>
            Category hierarchy loaded via <code>/api</code> proxy (best-effort).
          </>
        ) : (
          <>Browse categories available in this store.</>
        )}
      </p>

      <div className="toolbar" aria-label="Category filters">
        <label>
          <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
            Filter by name{showDeveloperDetails ? "/code" : ""}
          </span>
          <input
            className="textInput"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder='e.g. "shirts", "cotton"'
            aria-label="Filter categories"
          />
        </label>
      </div>

      {loading && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Loading categories…
          </p>
        </div>
      )}

      {!loading && result && !result.ok && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Unable to load categories</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {result.status ? (
              <>
                HTTP <strong>{result.status}</strong>
              </>
            ) : (
              "Request failed"
            )}
            {showDeveloperDetails && result.url ? (
              <>
                {" "}
                · URL: <code>{result.url}</code>
              </>
            ) : null}
          </p>

          {result.status === 404 ? (
            <div className="alert" role="status">
              <div className="alertTitle">Catalog unavailable</div>
              {showDeveloperDetails ? (
                <p style={{ marginBottom: 0 }}>
                  This UI only calls the modern catalog endpoint. A 404 usually means the API gateway is not routing{" "}
                  <code>/api/v1/catalog/**</code>, or the configured store UUID does not exist (see{" "}
                  <code>VITE_DEFAULT_STORE_ID</code>).
                </p>
              ) : (
                <p style={{ marginBottom: 0 }}>Please try again in a moment. If the issue persists, contact support.</p>
              )}
            </div>
          ) : (
            <>
              <p style={{ marginBottom: 0, color: "crimson", whiteSpace: "pre-wrap" }}>
                {result.error ?? "Unknown error"}
              </p>

              {showDeveloperDetails && (
                <details style={{ marginTop: "0.75rem" }}>
                  <summary className="muted">Diagnostics (response body)</summary>
                  <pre style={{ overflowX: "auto", margin: "0.5rem 0 0 0" }}>
                    {result.bodyText ? result.bodyText.slice(0, 4000) : "(empty body)"}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {!loading && result?.ok && roots.length === 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No categories</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            The backend responded successfully, but returned an empty category tree.
          </p>
        </div>
      )}

      {!loading && result?.ok && roots.length > 0 && filteredRoots.length === 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No matches</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Try a different filter.
            {showDeveloperDetails ? (
              <>
                {" "}
                Tip: searching by category <code>code</code> often works well.
              </>
            ) : null}
          </p>
        </div>
      )}

      {!loading && result?.ok && filteredRoots.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Category tree</h2>
          <ul style={{ marginTop: 0 }}>
            {filteredRoots.map((n, idx) => (
              <CategoryTreeNodeView
                key={`${n.code ?? n.id ?? "cat"}-${idx}`}
                node={n}
                defaultOpen={showExpanded}
                showDeveloperDetails={showDeveloperDetails}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
