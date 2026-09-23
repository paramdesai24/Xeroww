export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly title: string;
  readonly fieldErrors: FieldErrors;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(options: {
    code: string;
    message: string;
    title?: string;
    status?: number;
    fieldErrors?: FieldErrors;
    requestId?: string;
    retryable?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.title = options.title ?? titleForStatus(options.status);
    this.fieldErrors = options.fieldErrors ?? {};
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? isRetryable(options.status);
  }
}

type ErrorPayload = {
  detail?: string | Array<{ loc?: Array<string | number>; msg?: string }>;
  error?: {
    code?: string;
    message?: string;
    details?: { fields?: Array<{ field?: string; message?: string }> };
  };
  request_id?: string;
};

function titleForStatus(status?: number): string {
  if (status === 401) return "Session expired";
  if (status === 403) return "Access unavailable";
  if (status === 404) return "Not found";
  if (status === 409) return "Update conflict";
  if (status === 422) return "Check your input";
  if (status === 429) return "Please slow down";
  if (status && status >= 500) return "Service unavailable";
  return "Unable to complete request";
}

function isRetryable(status?: number): boolean {
  return status == null || status === 408 || status === 429 || status >= 500;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) return "You do not have access to this resource.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "Refresh the page and try the change again.";
  if (status === 422) return "Check the highlighted fields and try again.";
  if (status === 429) return "Wait a moment, then try again.";
  if (status >= 500) return "The service could not complete the request. Try again shortly.";
  return "The request could not be completed.";
}

function fieldErrorsFromPayload(payload: ErrorPayload): FieldErrors {
  const normalized: FieldErrors = {};
  const fields = payload.error?.details?.fields;
  if (Array.isArray(fields)) {
    for (const item of fields) {
      if (item.field && item.message) normalized[item.field] = item.message;
    }
    return normalized;
  }

  if (Array.isArray(payload.detail)) {
    for (const item of payload.detail) {
      const parts = (item.loc ?? []).filter((part) => !["body", "path", "query"].includes(String(part)));
      const field = parts.join(".") || "request";
      normalized[field] = item.msg || "Check this value and try again.";
    }
  }
  return normalized;
}

export async function errorFromResponse(response: Response): Promise<AppError> {
  const raw = await response.text().catch(() => "");
  let payload: ErrorPayload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as ErrorPayload;
    } catch {
      payload = {};
    }
  }

  const message = payload.error?.message
    ?? (typeof payload.detail === "string" ? payload.detail : undefined)
    ?? fallbackMessage(response.status);

  return new AppError({
    code: payload.error?.code ?? `HTTP_${response.status}`,
    message,
    status: response.status,
    fieldErrors: fieldErrorsFromPayload(payload),
    requestId: payload.request_id,
  });
}

export function normalizeError(reason: unknown, fallback = "The request could not be completed."): AppError {
  if (reason instanceof AppError) return reason;
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return new AppError({ code: "REQUEST_CANCELLED", message: "The request was cancelled.", retryable: true });
  }
  if (reason instanceof Error) {
    const networkFailure = reason instanceof TypeError;
    return new AppError({
      code: networkFailure ? "NETWORK_ERROR" : "CLIENT_ERROR",
      title: networkFailure ? "Connection problem" : undefined,
      message: networkFailure ? "Check your connection and try again." : reason.message || fallback,
      retryable: networkFailure,
    });
  }
  return new AppError({ code: "UNKNOWN_ERROR", message: fallback, retryable: true });
}
