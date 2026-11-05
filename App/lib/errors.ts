export class ApiError extends Error {
  constructor(public status: number, public body?: unknown) {
    super(detailFrom(body) ?? `Request failed (${status})`);
  }
}

function detailFrom(body: unknown) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const { detail, title, errors } = body as { detail?: unknown; title?: unknown; errors?: unknown };
    if (errors && typeof errors === "object") {
      const first = Object.values(errors).flat().find((message) => typeof message === "string");
      if (first) return first as string;
    }
    if (typeof detail === "string" && detail) return detail;
    if (typeof title === "string" && title) return title;
  }
  return undefined;
}

export function isNetworkError(error: unknown) {
  return error instanceof TypeError && /network|fetch/i.test(error.message);
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (isNetworkError(error)) return "No connection. Check your internet and try again.";
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session expired. Log in again.";
    if (error.status === 403) return "You don't have access to this.";
    if (error.status === 404) return "We couldn't find that.";
    if (error.status === 413) return "That file is too big.";
    if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
    if (error.status >= 500) return "The server is having problems. Try again in a bit.";
    return error.message;
  }
  return fallback;
}

export function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}
