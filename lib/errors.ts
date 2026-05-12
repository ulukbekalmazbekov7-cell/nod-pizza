type ErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const value = error as ErrorLike;
    const parts = [value.message, value.details, value.hint, value.code].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" · ");
    }
  }

  return fallback;
}
