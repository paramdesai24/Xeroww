import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("Render failure", error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="feedback-page" role="alert">
          <section>
            <p className="decision-eyebrow">Interface recovery</p>
            <h1>This view could not be displayed</h1>
            <p>Reload the application to return to a stable state.</p>
            <button className="decision-primary-action" onClick={() => window.location.reload()}>Reload Application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
