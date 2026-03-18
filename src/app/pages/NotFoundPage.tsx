import { Link } from "react-router-dom";

// PUBLIC_INTERFACE
export function NotFoundPage() {
  /** Fallback page for unknown routes. */
  return (
    <div>
      <h1>Page not found</h1>
      <p className="muted">The page you requested does not exist.</p>
      <p>
        <Link to="/">Go to Storefront Home</Link>
      </p>
    </div>
  );
}
