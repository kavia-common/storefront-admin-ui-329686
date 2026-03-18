import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

// PUBLIC_INTERFACE
export function CustomerLoginPage() {
  /**
   * Customer login page.
   *
   * Behavior:
   * - Calls StoreSessionContext.actions.loginCustomer()
   * - If backend auth endpoints are missing, flow falls back to UI-only local sign-in
   * - On success, redirects to /account (or `location.state.from`)
   */
  const navigate = useNavigate();
  const location = useLocation();
  const {
    derived: { isAuthenticated, showDeveloperDetails },
    actions,
  } = useStoreSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/account";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    const r = await actions.loginCustomer({ email, password });
    if (r.ok) {
      navigate(from, { replace: true });
      setSubmitting(false);
      return;
    }

    setError(r.error);
    setSubmitting(false);
  };

  return (
    <div>
      <div className="pageTitleRow">
        <div>
          <h1 style={{ marginBottom: 0 }}>Sign in</h1>
          <p className="pageSubtitle">
            <Link to="/account">← Back to My Account</Link>
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      {isAuthenticated && (
        <div className="alert" role="status">
          <div className="alertTitle">Already signed in</div>
          <p style={{ marginBottom: 0 }}>
            You are already signed in. Go to <Link to="/account">My Account</Link>.
          </p>
        </div>
      )}

      <div className="card" style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0 }}>Customer login</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in to access account features where supported.
        </p>

        {error && (
          <div className="alert" role="status">
            <div className="alertTitle">Sign in failed</div>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{error}</p>
          </div>
        )}

        <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
              Email
            </span>
            <input
              className="textInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
              Password
            </span>
            <input
              className="textInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <div className="toolbar" style={{ marginTop: 0 }}>
            <button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <Link to="/account/register">Create an account →</Link>
          </div>

          {showDeveloperDetails && (
            <p className="muted" style={{ marginBottom: 0 }}>
              If secured APIs (like order history) still fail with 401, configure <code>VITE_DEV_BEARER_TOKEN</code> for
              this environment.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
