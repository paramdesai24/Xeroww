import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return <main className="decision-page"><div className="decision-empty"><h1>Page not found</h1><Link className="decision-primary-action" to="/">Return Home</Link></div></main>;
}
