import { Link } from "react-router-dom";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

// PUBLIC_INTERFACE
export function MyAccountPage() {
  /**
   * My Account landing page (MVP).
   *
   * Auth behavior:
   * - Shows signed-in state when available (backend token, dev token, or local fallback)
   * - Provides login/register links when guest
   * - Orders pages will use auth bearer token when present, otherwise fall back to local order history
   */
  const {
    state: { storeId, customerId, auth, showDeveloperDetails, showAdminSessionOptions },
    derived,
    actions,
  } = useStoreSession();

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>My Account</h1>
          <p className="pageSubtitle">Account settings and order history</p>
        </div>
        <span className="badge">MVP</span>
      </div>

      {showDeveloperDetails && (
        <p className="muted">
          Store <code>{storeId}</code> · Customer context <code>{customerId}</code>
        </p>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Preferences</h2>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              Control whether the storefront shows developer/debug details like endpoint paths, internal IDs, and
              diagnostics.
            </p>

            <label style={{ display: "flex", gap: "0.6rem", alignItems: "start" }}>
              <input
                type="checkbox"
                checked={showDeveloperDetails}
                onChange={(e) => actions.setShowDeveloperDetails(e.target.checked)}
                aria-label="Show developer details"
              />
              <span>
                <div style={{ fontWeight: 800 }}>Show developer details</div>
                <div className="muted" style={{ marginTop: "0.15rem" }}>
                  {showDeveloperDetails
                    ? "Developer information is visible."
                    : "Developer information is hidden (recommended for most shoppers)."}
                </div>
              </span>
            </label>
          </div>

          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              Control whether admin links and session controls appear in the top bar. When disabled, the header shows
              only storefront navigation.
            </p>

            <label style={{ display: "flex", gap: "0.6rem", alignItems: "start" }}>
              <input
                type="checkbox"
                checked={showAdminSessionOptions}
                onChange={(e) => actions.setShowAdminSessionOptions(e.target.checked)}
                aria-label="Show admin and session options in the top bar"
              />
              <span>
                <div style={{ fontWeight: 800 }}>Show admin + session options in top bar</div>
                <div className="muted" style={{ marginTop: "0.15rem" }}>
                  {showAdminSessionOptions
                    ? "Admin links and session controls are visible in the header."
                    : "Header is storefront-only (default)."}
                </div>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Sign-in status</h2>

        {auth.status === "authenticated" ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Signed in as <strong>{derived.authLabel}</strong>.
              {showDeveloperDetails ? (
                <>
                  {" "}
                  ({auth.source}
                  {derived.bearerToken ? ", bearer token available" : ", no bearer token"}).
                </>
              ) : null}
            </p>
            <div className="toolbar">
              <button onClick={() => actions.logoutCustomer()}>Sign out</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              You are browsing as a guest. Sign in or create an account to enable customer-specific features where
              supported.
            </p>
            <div className="toolbar">
              <Link to="/account/login">Sign in →</Link>
              <Link to="/account/register">Create account →</Link>
            </div>
          </>
        )}

        {showDeveloperDetails && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Note: In some environments, secured APIs require <code>VITE_DEV_BEARER_TOKEN</code>.
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Orders</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          View your past orders (backend when available; local fallback otherwise).
        </p>

        <div className="toolbar">
          <Link to="/account/orders">Order history →</Link>
        </div>
      </div>

      {showDeveloperDetails && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Profile (coming soon)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Future phases can integrate a real <code>/api/customers/me</code> profile endpoint when available.
          </p>
        </div>
      )}
    </div>
  );
}
