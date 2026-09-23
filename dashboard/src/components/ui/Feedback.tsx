import { Link } from "react-router-dom";
import type { AppError } from "../../api/errors";

export function ErrorNotice({ error, onRetry, onDismiss }: { error: AppError; onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <div className="feedback-notice feedback-notice--error" role="alert">
      <div>
        <strong>{error.title}</strong>
        <span>{error.message}</span>
        {error.requestId && <small>Reference {error.requestId}</small>}
      </div>
      <div className="feedback-notice__actions">
        {onRetry && error.retryable && <button onClick={onRetry}>Retry</button>}
        {onDismiss && <button onClick={onDismiss} aria-label="Dismiss error">Dismiss</button>}
      </div>
    </div>
  );
}

export function SuccessNotice({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="feedback-notice feedback-notice--success" role="status">
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss confirmation">Dismiss</button>}
    </div>
  );
}

export function PageErrorState({
  title,
  message,
  actionHref,
  actionLabel,
  onRetry,
}: {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <main className="feedback-page" role="alert">
      <section>
        <p className="decision-eyebrow">Unable to open this view</p>
        <h1>{title}</h1>
        <p>{message}</p>
        <div>
          {onRetry && <button className="decision-primary-action" onClick={onRetry}>Try Again</button>}
          {actionHref && actionLabel && <Link className="decision-secondary-action" to={actionHref}>{actionLabel}</Link>}
        </div>
      </section>
    </main>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return <div className="feedback-empty"><strong>{title}</strong><span>{message}</span>{action}</div>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <span className="feedback-field-error" role="alert">{message}</span> : null;
}
