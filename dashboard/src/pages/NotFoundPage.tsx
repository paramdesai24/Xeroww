import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return <main className="decision-page"><div className="decision-empty"><h1>Workspace not found</h1><Link className="decision-primary-action" to="/market/RELIANCE.NS">Return to Market</Link></div></main>;
}
