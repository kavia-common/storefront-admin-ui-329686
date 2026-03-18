import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStoreSession } from "../../../shared/session/StoreSessionContext";

// PUBLIC_INTERFACE
export function CustomerRegisterPage() {
  /**
   * Customer registration page.
   *
   * Behavior:
   * - Calls StoreSessionContext.actions.registerCustomer()
   * - If backend registration endpoints are missing, falls back to local UI-only sign-in
   * - On success, redirects to /account
   */
  const navigate = useNavigate();
  const {
    actions,
    derived: { showDeveloperDetails },
  } = useStoreSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    const r = await actions.registerCustomer({ email, password, confirmPassword, firstName, lastName });
    if (r.ok) {
      navigate("/account", { replace: true });
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
          <h1 style={{ marginBottom: 0 }}>Create account</h1>
          <p className="pageSubtitle">
            <Link to="/account">← Back to My Account</Link>
          </p>
        </div>
        <span className="badge">MVP</span>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>Customer registration</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Create an account to access account features where supported.
        </p>

        {error && (
          <div className="alert" role="status">
            <div className="alertTitle">Registration failed</div>
            <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{error}</p>
          </div>
        )}

        <form onSubmit={(e) => void onSubmit(e)} style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                First name (optional)
              </span>
              <input className="textInput" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Last name (optional)
              </span>
              <input className="textInput" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Password
              </span>
              <input
                className="textInput"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: "0.25rem" }}>
                Confirm password
              </span>
              <input
                className="textInput"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          <div className="toolbar" style={{ marginTop: 0 }}>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create account"}
            </button>
            <Link to="/account/login">Already have an account? Sign in →</Link>
          </div>

          {showDeveloperDetails && (
            <p className="muted" style={{ marginBottom: 0 }}>
              If your environment requires JWT for secured APIs, configure <code>VITE_DEV_BEARER_TOKEN</code>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
